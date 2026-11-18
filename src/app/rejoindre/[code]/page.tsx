import { acceptInvitation } from "@/app/actions";
import { SubmitButton } from "@/components/submit-button";
import { getI18n } from "@/i18n";

export default async function JoinPage({
  params,
  searchParams,
}: {
  params: Promise<{ code: string }>;
  searchParams: Promise<{ erreur?: string }>;
}) {
  const { t } = await getI18n();
  const { code } = await params;
  const { erreur } = await searchParams;
  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center gap-6 px-4 py-10">
      <h1 className="text-2xl font-bold">{t.join.title}</h1>
      {erreur && <p className="rounded-lg bg-danger/10 p-3 text-sm text-danger">{t.join.invalid}</p>}
      <form action={acceptInvitation} className="card flex flex-col gap-4">
        <input type="hidden" name="code" value={code} />
        <div>
          <label className="label" htmlFor="display_name">{t.join.yourName}</label>
          <input className="input" id="display_name" name="display_name" required maxLength={60} />
        </div>
        <SubmitButton>{t.join.accept}</SubmitButton>
      </form>
    </main>
  );
}
