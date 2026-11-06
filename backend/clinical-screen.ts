import "server-only";
import type {
  VisitHistoryItem,
  VisitMeasurement,
} from "../shared/clinical-model";
import type {
  ClinicalResult,
  ClinicalSnapshot,
  ScreenRequest,
} from "../shared/clinical-types";
import {
  attempt,
  invalid,
  normalizeClinicalNumber,
  session,
  validId,
} from "./clinical-core";

const measurementStrings = (
  values: Record<string, number> | null | undefined
): VisitMeasurement =>
  Object.fromEntries(
    Object.entries(values ?? {}).map(([key, value]) => [key, String(value)])
  );

const completionFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Damascus",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});
function completedVisitDate(timestamp: string) {
  const parts = Object.fromEntries(
    completionFormatter
      .formatToParts(new Date(timestamp))
      .map(({ type, value }) => [type, value])
  );
  const date = `${parts.year}-${parts.month}-${parts.day}`;
  return { date, detailDate: `${date} · ${parts.hour}:${parts.minute}` };
}

async function readBatches<Row>(
  ids: string[],
  query: (
    batch: string[]
  ) => PromiseLike<{ data: Row[] | null; error: unknown }>
): Promise<Row[]> {
  const responses = await Promise.all(
    Array.from({ length: Math.ceil(ids.length / 100) }, (_, index) =>
      query(ids.slice(index * 100, index * 100 + 100))
    )
  );
  const rows: Row[] = [];
  for (const response of responses) {
    if (response.error) throw response.error;
    rows.push(...(response.data ?? []));
  }
  return rows;
}

export async function getClinicScreen(
  input: ScreenRequest
): Promise<ClinicalResult<ClinicalSnapshot>> {
  return attempt(async () => {
    if (
      !input ||
      typeof input.term !== "string" ||
      input.term.length > 160 ||
      !Number.isInteger(input.page) ||
      input.page < 0 ||
      input.page > 100000 ||
      (input.patient && !validId(input.patient)) ||
      (input.entry && !validId(input.entry))
    )
      invalid();
    const { client, account } = await session();
    const clinic = account.clinicId;
    const date = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Damascus",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date());
    const term = normalizeClinicalNumber(input.term)
      .replace(/[^\p{L}\p{N}\s+]/gu, " ")
      .trim();
    let patientQuery = client
      .from("patients")
      .select("id,full_name,phone,height_cm,gender,birth_year,goal,revision")
      .eq("clinic_id", clinic)
      .order("full_name")
      .order("id")
      .range(input.page * 50, input.page * 50 + 50);
    if (term)
      patientQuery = patientQuery.or(
        `full_name.ilike.%${term}%,phone.ilike.%${term}%`
      );
    const patientsResult = await patientQuery;
    if (patientsResult.error) throw patientsResult.error;
    let queueQuery = client
      .from("daily_queue")
      .select(
        "id,patient_id,visit_type,status,arrived_at,queue_date,revision,handed_off_at"
      )
      .eq("clinic_id", clinic)
      .order("arrived_at")
      .limit(501);
    // Unfinished visits from earlier days still occupy the clinic's single slot.
    queueQuery = queueQuery.or(
      `queue_date.eq.${date},status.eq.with_doctor${input.entry ? `,id.eq.${input.entry}` : ""}`
    );
    const queueResult = await queueQuery;
    if (queueResult.error) throw queueResult.error;
    if (queueResult.data.length > 500)
      throw new Error("Queue exceeds operational page bound");
    const selectedIds = [
      ...new Set([
        ...queueResult.data.map((row) => row.patient_id as string),
        ...(input.patient ? [input.patient] : []),
      ]),
    ];
    const missingIds = selectedIds.filter(
      (id) => !patientsResult.data.slice(0, 50).some((row) => row.id === id)
    );
    const additional = await readBatches(missingIds, (batch) =>
      client
        .from("patients")
        .select("id,full_name,phone,height_cm,gender,birth_year,goal,revision")
        .eq("clinic_id", clinic)
        .in("id", batch)
    );
    const hasMore = patientsResult.data.length > 50;
    const patientRows = [...patientsResult.data.slice(0, 50), ...additional];
    const visits = {
      data: await readBatches(
        queueResult.data.map((row) => row.id as string),
        (batch) =>
          client
            .from("visits")
            .select(
              "id,patient_id,queue_entry_id,completed_at,created_at,doctor_opened_at"
            )
            .eq("clinic_id", clinic)
            .in("queue_entry_id", batch)
            .order("created_at", { ascending: false })
            .limit(501)
      ),
    };
    // Listed patients show visit counts everywhere, so read their history too.
    const history = await readBatches(
      patientRows.map((row) => row.id as string),
      (batch) =>
        client
          .from("visits")
          .select(
            "id,patient_id,queue_entry_id,completed_at,created_at,doctor_opened_at"
          )
          .eq("clinic_id", clinic)
          .in("patient_id", batch)
          .not("completed_at", "is", null)
          .order("created_at", { ascending: false })
          .limit(1000)
    );
    for (const row of history)
      if (!visits.data.some((v) => v.id === row.id)) visits.data.push(row);
    const visitIds = visits.data.map((row) => row.id as string);
    const measured = await readBatches(visitIds, (batch) =>
      client
        .from("visit_measurements")
        .select("visit_id,measurements")
        .eq("clinic_id", clinic)
        .in("visit_id", batch)
    );
    const measurements = new Map(
      measured.map((row) => [
        row.visit_id,
        measurementStrings(row.measurements),
      ])
    );
    const visitKinds = new Map(
      queueResult.data.map((row) => [row.id, row.visit_type])
    );
    const historyQueueIds = visits.data
      .filter((v) => v.completed_at && !visitKinds.has(v.queue_entry_id))
      .map((v) => v.queue_entry_id as string);
    if (historyQueueIds.length) {
      const historical = await client
        .from("daily_queue")
        .select("id,visit_type")
        .eq("clinic_id", clinic)
        .in("id", historyQueueIds);
      if (historical.error) throw historical.error;
      historical.data.forEach((row) => visitKinds.set(row.id, row.visit_type));
    }
    const queue = queueResult.data.map((row) => {
      const v = visits.data.find((item) => item.queue_entry_id === row.id);
      return {
        id: row.id as string,
        patientId: row.patient_id as string,
        kind: row.visit_type as "full_exam" | "follow_up",
        status: row.status as "waiting" | "ready" | "with_doctor" | "completed",
        revision: row.revision as number,
        visitId: v?.id as string | undefined,
        handedOffAt: (row.handed_off_at as string | null) ?? undefined,
        doctorOpened: !!v?.doctor_opened_at,
        arrivalTime: new Intl.DateTimeFormat("en-GB", {
          timeZone: "Asia/Damascus",
          hour: "2-digit",
          minute: "2-digit",
        }).format(new Date(row.arrived_at)),
        measurements: measurements.get(v?.id) ?? {},
      };
    });
    const selectedVisit = queue.find((row) => row.id === input.entry);
    if (account.role === "doctor" && selectedVisit?.visitId) {
      const id = selectedVisit.visitId;
      const previousVisit = await client
        .from("visits")
        .select("id")
        .eq("clinic_id", clinic)
        .eq("patient_id", selectedVisit.patientId)
        .not("completed_at", "is", null)
        .neq("id", id)
        .order("completed_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (previousVisit.error) throw previousVisit.error;
      const [notes, diet, appointment, previousDiet] = await Promise.all([
        client
          .from("visit_private_notes")
          .select("notes")
          .eq("visit_id", id)
          .maybeSingle(),
        client
          .from("diet_plans")
          .select("days")
          .eq("visit_id", id)
          .maybeSingle(),
        client
          .from("appointments")
          .select("appointment_date")
          .eq("originating_visit_id", id)
          .maybeSingle(),
        previousVisit.data
          ? client
              .from("diet_plans")
              .select("days")
              .eq("visit_id", previousVisit.data.id)
              .maybeSingle()
          : Promise.resolve({ data: null, error: null }),
      ]);
      for (const result of [notes, diet, appointment, previousDiet])
        if (result.error) throw result.error;
      Object.assign(selectedVisit, {
        visit: {
          notes: notes.data?.notes ?? "",
          days: diet.data?.days ?? [],
          appointment: appointment.data?.appointment_date ?? "",
          completedAt:
            visits.data.find((v) => v.id === id)?.completed_at ?? undefined,
        },
        previousPlan: previousDiet.data?.days?.length
          ? previousDiet.data.days
          : undefined,
      });
    }
    return {
      clinicId: clinic,
      role: account.role,
      serviceDate: date,
      hasMore,
      queue,
      patients: patientRows.map((row) => {
        const completed = visits.data
          .filter((v) => v.patient_id === row.id && v.completed_at)
          .sort((a, b) =>
            String(b.completed_at).localeCompare(String(a.completed_at))
          );
        return {
          id: row.id,
          name: row.full_name,
          phone: row.phone ?? "",
          height: row.height_cm == null ? "" : String(row.height_cm),
          gender: row.gender ?? "",
          birthYear: row.birth_year == null ? "" : String(row.birth_year),
          goal: row.goal ?? "",
          revision: row.revision,
          visits: completed.map((v, index) => ({
            id: v.queue_entry_id,
            number: completed.length - index,
            ...completedVisitDate(String(v.completed_at)),
            kind: visitKinds.get(v.queue_entry_id),
            measurements: measurements.get(v.id) ?? {},
          })) as VisitHistoryItem[],
        };
      }),
    };
  });
}
