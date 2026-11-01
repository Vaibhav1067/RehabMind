import type { Metadata } from "next";
import { z } from "zod";

import { OwnWords } from "@/components/OwnWords";
import { PatientGoals } from "@/components/patient/PatientGoals";
import { WeekActivity } from "@/components/patient/WeekActivity";
import {
  CarerSummarySchema,
  MessageListSchema,
  PersonalWordSchema,
  SupportedPatientSchema,
} from "@/lib/api/schemas";
import { backendGet } from "@/lib/api/server";

import { SendNote } from "./SendNote";

export const metadata: Metadata = { title: "Family" };

/**
 * Family and carers help practice at home: they see how often (never how well) the
 * patient practises, the goals their care team set, and add the patient's own words.
 */
export default async function CarerHome() {
  const patients = await backendGet(
    "/carer/patients",
    z.array(SupportedPatientSchema),
  );
  const patient = patients?.[0];
  if (!patient)
    return (
      <div className="flex flex-col gap-3">
        <h1 className="text-3xl font-bold">Welcome</h1>
        <p className="text-lg text-ink-muted">
          Your account isn&rsquo;t linked to anyone yet. Please ask the care
          team to link it.
        </p>
      </div>
    );
  const [summary, words, sent] = await Promise.all([
    backendGet(`/carer/patients/${patient.id}`, CarerSummarySchema),
    backendGet(
      `/carer/patients/${patient.id}/words`,
      z.array(PersonalWordSchema),
    ),
    backendGet(`/carer/patients/${patient.id}/messages`, MessageListSchema),
  ]);
  const name = patient.display_name;

  return (
    <div className="flex flex-col gap-10">
      <div className="flex flex-col gap-1">
        <h1 className="text-3xl font-bold tracking-tight">
          How {name} is getting on
        </h1>
        <p className="text-ink-muted">
          You support {name} ({patient.relationship}).
        </p>
      </div>

      {summary && <WeekActivity activity={summary.activity} name={name} />}

      <div className="grid gap-x-12 gap-y-8 border-t border-line pt-6 lg:grid-cols-2">
        {summary?.goals.length ? (
          <PatientGoals goals={summary.goals} name={name} />
        ) : (
          <p className="text-ink-muted">
            {name}&rsquo;s care team hasn&rsquo;t set goals yet.
          </p>
        )}
        <SendNote patientId={patient.id} name={name} sent={sent ?? []} />
      </div>

      <section
        aria-labelledby="words-heading"
        className="flex flex-col gap-4 border-t border-line pt-6"
      >
        <div>
          <h2 id="words-heading" className="text-xl font-bold">
            {name}&rsquo;s own words
          </h2>
          <p className="max-w-prose text-ink-muted">
            Photos of the people, pets and things in {name}&rsquo;s life. They
            appear in practice alongside the usual pictures.
          </p>
        </div>
        <OwnWords
          apiBase={`/carer/patients/${patient.id}/words`}
          patientName={name}
          words={words ?? []}
        />
      </section>
    </div>
  );
}
