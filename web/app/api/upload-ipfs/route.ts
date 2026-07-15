import { NextResponse } from "next/server";

// 🇪🇸 NOTA: esta subida vive server-side A PROPÓSITO. La `PINATA_JWT` es un secreto; si el navegador
//    llamara a Pinata directamente, la key quedaría expuesta en el bundle/red del cliente. El route
//    recibe el memo, pina el JSON con la key desde env, y solo devuelve el CID (público) al cliente.

const PIN_JSON_URL = "https://api.pinata.cloud/pinning/pinJSONToIPFS";
const MAX_MEMO_LENGTH = 2000;

interface UploadBody {
  memo?: unknown;
  creator?: unknown;
}

export async function POST(request: Request) {
  const jwt = process.env.PINATA_JWT;
  if (!jwt) {
    // 🇪🇸 error de CONFIGURACIÓN (no de datos): la env var no está puesta. Sin filtrar nada.
    return NextResponse.json({ error: "IPFS upload is not configured." }, { status: 500 });
  }

  let body: UploadBody;
  try {
    body = (await request.json()) as UploadBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const { memo, creator } = body;
  if (typeof memo !== "string" || memo.trim() === "") {
    return NextResponse.json({ error: "Memo must be a non-empty string." }, { status: 400 });
  }
  if (memo.length > MAX_MEMO_LENGTH) {
    return NextResponse.json(
      { error: `Memo is too long (max ${MAX_MEMO_LENGTH} characters).` },
      { status: 400 },
    );
  }

  // JSON estructurado (decisión: no texto plano). `createdAt` lo pone el servidor.
  const pinataContent = {
    version: 1,
    memo,
    createdAt: new Date().toISOString(),
    creator: typeof creator === "string" ? creator : null,
  };

  try {
    const res = await fetch(PIN_JSON_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${jwt}`,
      },
      body: JSON.stringify({
        pinataContent,
        pinataMetadata: { name: "escrow-operation-memo.json" },
        pinataOptions: { cidVersion: 1 },
      }),
    });

    if (!res.ok) {
      // 🇪🇸 Log detallado SOLO en servidor; al cliente un mensaje genérico (sin cuerpo de Pinata ni key).
      const detail = await res.text().catch(() => "");
      console.error(`Pinata pinJSONToIPFS failed: ${res.status} ${detail}`);
      return NextResponse.json({ error: "Failed to pin memo to IPFS." }, { status: 502 });
    }

    const data = (await res.json()) as { IpfsHash?: string };
    if (!data.IpfsHash) {
      console.error("Pinata response missing IpfsHash:", data);
      return NextResponse.json({ error: "Failed to pin memo to IPFS." }, { status: 502 });
    }

    return NextResponse.json({ cid: data.IpfsHash });
  } catch (err) {
    console.error("Pinata request error:", err);
    return NextResponse.json({ error: "Failed to reach the IPFS pinning service." }, { status: 502 });
  }
}
