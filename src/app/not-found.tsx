import Link from "next/link";

export default function NotFound() {
  return (
    <div className="m-auto flex flex-col items-center gap-3 p-8 text-center">
      <h1 className="text-xl font-semibold">Page not found</h1>
      <Link href="/image" className="button-primary">Open the Image studio</Link>
    </div>
  );
}
