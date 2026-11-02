// Creates first-time passwords for a batch and downloads them as a CSV. The server limits how many it does per request.
export async function issueAndDownloadPasswords(batch: string) {
  const issued: any[] = [];
  let failure: string | null = null;

  try {
    for (;;) {
      const res = await fetch("/api/students/issue-passwords", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ batch }),
      });
      const data = await res.json();
      if (!data.success) {
        failure = data.error || "Could not issue passwords.";
        break;
      }
      issued.push(...data.issued);
      if (data.remaining === 0 || data.issued.length === 0) break;
    }
  } catch {
    failure = "The connection was lost. Any passwords created so far are in the download; run this again for the rest.";
  }

  if (issued.length > 0) {
    const quote = (value: unknown) => `"${String(value ?? "").replace(/"/g, '""')}"`;
    const csv = [
      "Student ID,Name,Batch,Phone,Temporary Password",
      ...issued.map((s) => [s.id, s.name, s.batch, s.phone, s.tempPassword].map(quote).join(",")),
    ].join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `ram_raj_student_passwords_${Date.now()}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  return { count: issued.length, failure };
}
