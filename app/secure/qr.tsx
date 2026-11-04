"use client";

import { useEffect, useRef, useState } from "react";
import jsQR from "jsqr";
import QRCode from "qrcode";
import { X } from "lucide-react";

// QR 보여 주기 · 찍기. 찍은 영상은 폰 안에서만 읽고 어디로도 보내지 않는다.

export function QrImage({ text, size = 220 }: { text: string; size?: number }) {
  const [svg, setSvg] = useState("");
  useEffect(() => {
    let alive = true;
    QRCode.toString(text, { type: "svg", margin: 1, errorCorrectionLevel: "M", color: { dark: "#191f28", light: "#ffffff" } })
      .then((markup) => alive && setSvg(markup))
      .catch(() => alive && setSvg(""));
    return () => {
      alive = false;
    };
  }, [text]);
  // qrcode 라이브러리가 만든 SVG(우리 데이터만 들어감)를 그대로 그린다.
  return <div className="qr-image" style={{ width: size, height: size }} dangerouslySetInnerHTML={{ __html: svg }} />;
}

export function QrScanner({ onCode, onClose }: { onCode: (text: string) => void; onClose: () => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [error, setError] = useState(() =>
    typeof navigator !== "undefined" && !navigator.mediaDevices ? "이 브라우저는 카메라를 쓸 수 없어요. 코드 붙여넣기를 써 주세요." : "",
  );

  useEffect(() => {
    let stream: MediaStream | null = null;
    let timer: ReturnType<typeof setInterval> | null = null;
    let done = false;
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d", { willReadFrequently: true });

    navigator.mediaDevices
      ?.getUserMedia({ video: { facingMode: "environment" }, audio: false })
      .then(async (media) => {
        stream = media;
        const video = videoRef.current;
        if (!video) return;
        video.srcObject = media;
        await video.play();
        timer = setInterval(() => {
          if (done || !context || video.readyState < 2) return;
          canvas.width = video.videoWidth;
          canvas.height = video.videoHeight;
          context.drawImage(video, 0, 0);
          const found = jsQR(context.getImageData(0, 0, canvas.width, canvas.height).data, canvas.width, canvas.height);
          if (found?.data) {
            done = true;
            onCode(found.data);
          }
        }, 250);
      })
      .catch(() => setError("카메라를 쓸 수 없어요. 설정에서 카메라를 허용하거나 코드 붙여넣기를 써 주세요."));

    return () => {
      done = true;
      if (timer) clearInterval(timer);
      stream?.getTracks().forEach((track) => track.stop());
    };
  }, [onCode]);

  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <section className="sheet scanner" onClick={(event) => event.stopPropagation()}>
        <div className="card-head">
          <h3 className="card-title">상대 폰 QR 찍기</h3>
          <button className="icon-close" aria-label="닫기" onClick={onClose}><X size={20} /></button>
        </div>
        {error ? <p className="badge bad">{error}</p> : <video ref={videoRef} playsInline muted className="scanner-video" />}
      </section>
    </div>
  );
}
