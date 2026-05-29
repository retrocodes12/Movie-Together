import { Link } from "react-router";

export default function NotFound() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[#0b0d10] px-4 text-[#f6f3ed]">
      <section className="max-w-md rounded-lg border border-[#25282d] bg-[#15181d] p-6 text-center">
        <h1 className="text-2xl font-semibold">Page not found</h1>
        <p className="mt-2 text-sm text-[#8d949e]">This Watch Together route does not exist.</p>
        <Link className="primary-btn mt-5" to="/">Back to Watch Together</Link>
      </section>
    </main>
  );
}
