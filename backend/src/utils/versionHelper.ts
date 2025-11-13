import axios from "axios";

interface VersionInfo {
  version: string;
  beta: boolean;
  released: string;
  expire: string;
}

interface VersionsResponse {
  currentBeta: string | null;
  currentVersion: string;
  versions: VersionInfo[];
}

/**
 * URL principal (CDN) e fallback (GitHub)
 */
const CDN_URL =
  "https://cdn.jsdelivr.net/gh/wppconnect-team/wa-version@main/versions.json";
const GITHUB_URL =
  "https://raw.githubusercontent.com/wppconnect-team/wa-version/main/versions.json";

/**
 * Busca a versão do WhatsApp Web com fallback automático
 */
export async function getVersionByIndexFromUrl(
  index: number = 2
): Promise<[number, number, number]> {
  try {
    let versionsData: VersionsResponse | null = null;

    try {
      // 1️⃣ Tenta buscar do CDN (mais rápido e sem limite)
      const response = await axios.get<VersionsResponse>(CDN_URL, {
        timeout: 8000,
      });
      versionsData = response.data;
    } catch (cdnError) {
      console.warn("⚠️ Falha ao buscar via CDN, tentando GitHub direto...");
      // 2️⃣ Fallback: tenta buscar direto do GitHub
      const response = await axios.get<VersionsResponse>(GITHUB_URL, {
        timeout: 8000,
      });
      versionsData = response.data;
    }

    // 3️⃣ Valida os dados recebidos
    if (!versionsData?.versions || versionsData.versions.length <= index) {
      throw new Error(`Array versions deve ter pelo menos ${index + 1} itens`);
    }

    const versionItem = versionsData.versions[index];
    if (!versionItem?.version) {
      throw new Error(
        `Item na posição ${index} não encontrado ou sem versão válida`
      );
    }

    // 4️⃣ Limpa e converte a versão
    const versionWithoutAlpha = versionItem.version.replace("-alpha", "");
    const [major, minor, patch] = versionWithoutAlpha.split(".").map(Number);

    return [major, minor, patch];
  } catch (error) {
    console.error("❌ Erro ao buscar versão do WhatsApp Web:", error);
    // 5️⃣ Fallback fixo (versão estável conhecida)
    return [2, 3000, 1022842143];
  }
}
