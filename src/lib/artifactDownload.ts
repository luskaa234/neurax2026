export async function downloadArtifactZip(params: {
  artifactUrl: string;
  projectName: string;
}): Promise<void> {
  const { artifactUrl, projectName } = params;

  const response = await fetch(artifactUrl, { method: "GET" });
  if (!response.ok) {
    throw new Error("Falha ao baixar o ZIP. O link pode ter expirado.");
  }

  const contentType = response.headers.get("content-type")?.toLowerCase() ?? "";
  if (!contentType.includes("application/zip")) {
    throw new Error("Download inválido: resposta não é ZIP (possível link expirado).");
  }

  const blob = await response.blob();
  const safeName = projectName.trim() || "project";

  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = `${safeName}.zip`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(link.href);
}
