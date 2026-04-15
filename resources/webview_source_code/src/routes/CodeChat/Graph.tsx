import React, { useState, useEffect, useRef } from 'react';
import ImagePreview from '../../components/ImagePreview';
// import Panzoom, { PanzoomObject } from '@panzoom/panzoom';

type GraphType = 'mermaid' | 'plantuml' | 'graphviz';

interface GraphProps {
  type: GraphType;
  chart: string;
  style?: React.CSSProperties;
}

const Graph: React.FC<GraphProps> = ({ type, chart, style }) => {
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // const [isImageLoaded, setIsImageLoaded] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  // const imageRef = useRef<HTMLImageElement>(null);
  // const panzoomRef = useRef<PanzoomObject | null>(null);

  // 加载图片
  useEffect(() => {
    setIsLoading(true);
    setError(null);
    // setIsImageLoaded(false);
    let blobUrl: string | null = null;

    const processedChart = type === 'mermaid' 
      ? `%%{init: {"theme": "dark"}}%%${chart}`
      : chart;

    fetch(`http://localhost:3001`, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/plain',
      },
      body: processedChart
    })
    .then(response => {
      if (!response.ok) {
        throw new Error('❌ 模型生成代码渲染失败，请重试本次生成');
      }
      return response.blob();
    })
    .then(blob => {
      blobUrl = URL.createObjectURL(blob);
      setIsLoading(false);
      setImageUrl(blobUrl);
    })
    .catch(error => {
      console.error('Error:', error);
      setError(error.message);
    });

    return () => {
      if (blobUrl) {
        URL.revokeObjectURL(blobUrl);
      }
    };
  }, [type, chart]);

  if (error) {
    return <div style={{
      display: 'flex',
      justifyContent: 'center',
      height: '100px',
      alignItems: 'center',
    }}>{error}</div>;
  }

  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'center',
        height: '100%',
        alignItems: 'center',
        minHeight: '200px',
        position: 'relative',
        overflow: 'hidden',
        ...style,
      }}
      className="graph-container"
    >
      {isLoading ? (
        <div className="graph-loading">
          <div className="spinner"></div>
          <p>Loading diagram...</p>
        </div>
      ) : (
        <div 
        ref={containerRef}
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          position: 'relative',
        }}
      >
        {/* <img
          ref={imageRef}
          style={{ 
            width: '100%',
            height: '100%',
            objectFit: 'contain',
            display: 'block',
          }}
          src={imageUrl!}
          alt="Diagram"
          draggable={false}
          // onLoad={() => setIsImageLoaded(true)}
        /> */}
        <ImagePreview w="100%" h="300px" url={imageUrl!} />
      </div>
      )}
    </div>
  );
};

export default Graph;