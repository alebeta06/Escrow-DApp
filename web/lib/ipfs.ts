// Cliente de IPFS del frontend: subida de memos (vía la API route server-side) y lectura desde
// un gateway público. La key de Pinata NUNCA vive aquí — solo en el route server-side.

/** Error de subida de memo a IPFS, con mensaje ya legible para el usuario. */
export class IpfsUploadError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "IpfsUploadError";
  }
}

interface UploadResponse {
  cid?: string;
  error?: string;
}

/**
 * Sube un memo a IPFS a través de `POST /api/upload-ipfs` (que tiene la key de Pinata) y devuelve el
 * CID. Lanza {@link IpfsUploadError} con un mensaje legible ante cualquier fallo (red, !ok, sin cid).
 */
export async function uploadMemo(memo: string, creator: string | null): Promise<string> {
  let res: Response;
  try {
    res = await fetch("/api/upload-ipfs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ memo, creator }),
    });
  } catch {
    throw new IpfsUploadError("Could not reach the IPFS upload service. Check your connection.");
  }

  let data: UploadResponse = {};
  try {
    data = (await res.json()) as UploadResponse;
  } catch {
    /* respuesta no-JSON: se trata como fallo abajo */
  }

  if (!res.ok || !data.cid) {
    throw new IpfsUploadError(
      data.error ?? "Could not upload the memo to IPFS.",
    );
  }
  return data.cid;
}

// 🇪🇸 Gateway de LECTURA (público, no secreto). Configurable por NEXT_PUBLIC_IPFS_GATEWAY; el default
//    resuelve cualquier CID de Pinata. El base debe incluir la ruta hasta /ipfs/ (ver .env.example).
const DEFAULT_GATEWAY = "https://gateway.pinata.cloud/ipfs/";

/** Construye la URL de gateway para un CID a partir de `NEXT_PUBLIC_IPFS_GATEWAY` (o el default). */
export function ipfsGatewayUrl(cid: string): string {
  const base = process.env.NEXT_PUBLIC_IPFS_GATEWAY || DEFAULT_GATEWAY;
  return `${base.replace(/\/+$/, "")}/${cid}`;
}
