import React, { useEffect, useId, useRef, useState } from 'react';
import { logUpload } from '../lib/mobileDebug';
import { useTelegram } from '../hooks/useTelegram';

interface FileUploadFieldProps {
  label: string;
  accept: string;
  hint: string;
  file: File | null;
  uploadProgress?: number | null;
  onFileChange: (file: File | null) => void;
  inputId?: string;
}

export const FileUploadField: React.FC<FileUploadFieldProps> = ({
  label,
  accept,
  hint,
  file,
  uploadProgress = null,
  onFileChange,
  inputId,
}) => {
  const autoId = useId();
  const id = inputId ?? `file-${autoId}`;
  const inputRef = useRef<HTMLInputElement>(null);
  const { isTelegram, hapticSelection } = useTelegram();

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0] ?? null;
    logUpload('file selected', selected ? { name: selected.name, size: selected.size, type: selected.type } : null);
    onFileChange(selected);
    if (selected) hapticSelection();
  };

  const openPicker = () => {
    logUpload('open picker', { isTelegram, accept });
    try {
      inputRef.current?.click();
    } catch (err) {
      logUpload('picker click failed', err);
    }
  };

  const clearFile = (e: React.MouseEvent) => {
    e.stopPropagation();
    onFileChange(null);
    if (inputRef.current) inputRef.current.value = '';
    logUpload('file cleared');
  };

  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!file?.type.startsWith('image/')) {
      setPreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const isImage = Boolean(previewUrl);

  return (
    <div className="file-upload glass-panel">
      <p className="field-label file-upload__title">{label}</p>

      <div className="file-upload__zone-wrap">
        <input
          ref={inputRef}
          id={id}
          type="file"
          className="file-upload__overlay"
          accept={accept}
          onChange={handleChange}
          aria-label={label}
        />
        <div className="file-upload__zone" aria-hidden="true">
          <span className="file-upload__icon">
            <svg viewBox="0 0 24 24" fill="none">
              <path
                d="M12 16V4m0 0L8 8m4-4 4 4M4 17v2a2 2 0 002 2h12a2 2 0 002-2v-2"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </span>
          <span className="file-upload__label">Нажмите, чтобы выбрать файл</span>
          <span className="file-upload__hint">{hint}</span>
        </div>
      </div>

      <button type="button" className="file-upload__btn" onClick={openPicker}>
        {file ? 'Заменить файл' : 'Открыть файлы'}
      </button>

      {uploadProgress !== null && uploadProgress < 100 && (
        <div className="upload-progress" role="progressbar" aria-valuenow={uploadProgress}>
          <span className="upload-progress__bar" style={{ width: `${uploadProgress}%` }} />
          <span className="upload-progress__text">Загрузка {uploadProgress}%</span>
        </div>
      )}

      {file && (
        <div className="file-upload__selected">
          {isImage && previewUrl && (
            <img className="file-upload__preview" src={previewUrl} alt="Превью" />
          )}
          <div className="file-upload__selected-row">
            <span className="file-upload__name" title={file.name}>
              {isImage ? '🖼️' : '📎'} {file.name}
            </span>
            <span className="file-upload__size">{(file.size / 1024).toFixed(0)} КБ</span>
            <button type="button" className="file-upload__remove" onClick={clearFile}>
              Удалить
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
