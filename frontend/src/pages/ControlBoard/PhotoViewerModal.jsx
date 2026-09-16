import { X } from "lucide-react";

export default function PhotoViewerModal({ viewingPhotoUrl, setViewingPhotoUrl }) {
  return (
    <div
      className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-6"
      onClick={() => setViewingPhotoUrl(null)}
    >
      <button
        onClick={() => setViewingPhotoUrl(null)}
        className="absolute top-6 right-6 text-white hover:text-slate-300 cursor-pointer"
      >
        <X className="w-6 h-6" />
      </button>
      <img
        src={viewingPhotoUrl}
        alt="첨부 사진 확대"
        className="max-w-full max-h-full rounded-lg"
        onClick={(e) => e.stopPropagation()}
      />
    </div>
  );
}
