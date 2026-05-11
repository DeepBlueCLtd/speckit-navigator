import { memo, useEffect, useState } from 'react';
import { strings } from '../strings';

interface Props {
  blob: Blob;
  name: string;
}

const LARGE_BYTES = 5 * 1024 * 1024;

function ImageViewImpl({ blob, name }: Props): JSX.Element {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    const next = URL.createObjectURL(blob);
    setUrl(next);
    return () => {
      URL.revokeObjectURL(next);
    };
  }, [blob]);

  return (
    <div className="artifact-body" data-testid="image-body">
      {blob.size > LARGE_BYTES && (
        <p className="image-large-notice">{strings.artifactView.imageLarge}</p>
      )}
      {url && <img src={url} alt={name} style={{ maxWidth: '100%' }} />}
    </div>
  );
}

export const ImageView = memo(ImageViewImpl);
