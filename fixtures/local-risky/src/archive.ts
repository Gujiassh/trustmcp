import AdmZip from "adm-zip";

export function unpackArchive(input: { archivePath: string; targetPath: string }) {
  const archive = new AdmZip(input.archivePath);
  archive.extractAllTo(input.targetPath, true);
}
