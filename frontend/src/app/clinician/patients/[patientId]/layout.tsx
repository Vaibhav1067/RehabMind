import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";

import { PatientNav } from "@/components/clinician/PatientNav";
import { PrintButton } from "@/components/clinician/PrintButton";
import { Alert } from "@/components/ui/Alert";
import { AIStatusSchema, PatientOverviewSchema } from "@/lib/api/clinician";
import { backendGet } from "@/lib/api/server";
import { formatDate } from "@/lib/format";

export default async function PatientLayout({
  children,
  params,
}: LayoutProps<"/clinician/patients/[patientId]">) {
  const { patientId } = await params;
  // The backend returns 404 unless this clinician is assigned to the patient.
  const [patient, aiStatus] = await Promise.all([
    backendGet(`/patients/${patientId}/overview`, PatientOverviewSchema),
    backendGet("/ai/status", AIStatusSchema),
  ]);
  if (!patient) notFound();
  // Only a configured local model can be "offline"; a deliberately AI-free setup is not.
  const aiOffline =
    aiStatus?.provider === "ollama" &&
    !(aiStatus.reachable && aiStatus.model_available);

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-3">
        <Link
          href="/clinician"
          className="no-print inline-flex min-h-target w-fit items-center gap-2 text-sm text-ink-muted hover:text-ink"
        >
          <ArrowLeft aria-hidden="true" size={16} />
          All patients
        </Link>
        <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
          <p className="text-2xl font-bold tracking-tight">
            {patient.display_name}
          </p>
          <p className="text-base text-ink-muted">
            Patient since {formatDate(patient.patient_since)} · Care team:{" "}
            {patient.care_team.join(", ")}
          </p>
          <div className="ml-auto">
            <PrintButton />
          </div>
        </div>
        <PatientNav patientId={patientId} />
      </div>
      {aiOffline && (
        <Alert tone="warning">
          <strong>AI is offline.</strong> Exercises, feedback and summaries use
          the rule-based versions until the local model{" "}
          {aiStatus?.model ? `(${aiStatus.model}) ` : ""}is running again.
          Practice is not affected.
        </Alert>
      )}
      {children}
      <p className="border-t border-line pt-4 text-sm text-ink-muted">
        Academic prototype. Figures describe recorded practice activity only;
        they are not a diagnosis, prognosis or validated clinical measure.
      </p>
    </div>
  );
}
