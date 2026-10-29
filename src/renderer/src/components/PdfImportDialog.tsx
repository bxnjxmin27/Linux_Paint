import { useEffect, useRef, useState } from 'react'
import { DialogShell } from './Dialogs'
import { useT } from '../i18n'
import { renderPdfPreview } from '../engine/pdf'
import { resolvePdfImport, usePdfImport } from '../state/pdfImport'

interface Preview {
  canvas: HTMLCanvasElement
  width: number
  height: number
}

export function PdfImportDialog(): React.ReactElement | null {
  const t = useT()
  const request = usePdfImport((s) => s.request)
  const page = usePdfImport((s) => s.page)
  const scale = usePdfImport((s) => s.scale)
  const setPage = usePdfImport((s) => s.setPage)
  const setScale = usePdfImport((s) => s.setScale)
  const [preview, setPreview] = useState<Preview | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(false)
  const previewCanvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    if (!request) return
    let cancelled = false
    setLoading(true)
    setError(false)
    renderPdfPreview(request.data, page, 440)
      .then((result) => {
        if (cancelled) return
        setPreview({ canvas: result.canvas, width: result.width, height: result.height })
      })
      .catch(() => {
        if (!cancelled) setError(true)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [request, page])

  useEffect(() => {
    if (!preview || !previewCanvasRef.current) return
    const canvas = previewCanvasRef.current
    canvas.width = preview.canvas.width
    canvas.height = preview.canvas.height
    const ctx = canvas.getContext('2d')
    if (ctx) {
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      ctx.drawImage(preview.canvas, 0, 0)
    }
  }, [preview])

  if (!request) return null

  return (
    <DialogShell
      title={t('pdfImportTitle')}
      onClose={() => resolvePdfImport(null)}
      width={540}
      actions={
        <>
          <button className="btn" onClick={() => resolvePdfImport(null)}>
            {t('cancel')}
          </button>
          <button
            className="btn primary"
            disabled={loading || error}
            onClick={() => resolvePdfImport({ page, scale })}
          >
            {t('pdfOpen')}
          </button>
        </>
      }
    >
      <div className="pdf-import-name" title={request.name}>
        {request.name}
      </div>
      <div className="pdf-import-grid">
        <div className="pdf-preview">
          <canvas
            ref={previewCanvasRef}
            className="pdf-preview-canvas"
            style={{ display: preview && !error ? 'block' : 'none' }}
          />
          {loading ? <div className="pdf-preview-message">{t('pdfLoading')}</div> : null}
          {error ? <div className="pdf-preview-message error">{t('pdfLoadError')}</div> : null}
        </div>
        <div className="pdf-import-controls">
          <div className="form-row">
            <label>{t('pdfPage')}</label>
            <div className="pdf-page-row">
              <button
                className="btn pdf-step"
                disabled={page <= 1}
                onClick={() => setPage(Math.max(1, page - 1))}
              >
                ‹
              </button>
              <input
                className="input narrow"
                type="number"
                min={1}
                max={request.pageCount}
                value={page}
                onChange={(e) => {
                  const next = Number(e.target.value) || 1
                  setPage(Math.max(1, Math.min(request.pageCount, next)))
                }}
              />
              <span className="pdf-page-count">
                {t('pdfOf')} {request.pageCount}
              </span>
              <button
                className="btn pdf-step"
                disabled={page >= request.pageCount}
                onClick={() => setPage(Math.min(request.pageCount, page + 1))}
              >
                ›
              </button>
            </div>
          </div>
          <div className="form-row">
            <label>{t('pdfResolution')}</label>
            <select className="input" value={scale} onChange={(e) => setScale(Number(e.target.value))}>
              <option value={1}>72 DPI</option>
              <option value={2}>144 DPI</option>
              <option value={3}>216 DPI</option>
              <option value={4}>288 DPI</option>
            </select>
          </div>
          <div className="pdf-size">
            {Math.round(request.width * scale)} × {Math.round(request.height * scale)} px
          </div>
          <p className="pdf-source-note">{t('pdfSourceNote')}</p>
        </div>
      </div>
    </DialogShell>
  )
}
