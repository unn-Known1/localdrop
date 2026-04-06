// Chunk processing Web Worker
// Handles hashing and chunk splitting off the main thread

interface ChunkMessage {
  type: 'hashChunk' | 'hashFile' | 'splitChunks';
  data: any;
  id: string;
}

interface ChunkResponse {
  type: 'hashChunkResult' | 'hashFileResult' | 'chunk' | 'done' | 'error';
  id: string;
  data?: any;
  error?: string;
}

async function hashChunk(data: ArrayBuffer): Promise<string> {
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

async function hashFile(file: File): Promise<string> {
  const buffer = await file.arrayBuffer();
  return hashChunk(buffer);
}

async function* splitIntoChunks(file: File, chunkSize: number): AsyncGenerator<{ chunk: ArrayBuffer; index: number; total: number }> {
  const fileSize = file.size;
  const totalChunks = Math.ceil(fileSize / chunkSize);
  
  for (let i = 0; i < totalChunks; i++) {
    const start = i * chunkSize;
    const end = Math.min(start + chunkSize, fileSize);
    const chunk = file.slice(start, end);
    const chunkBuffer = await chunk.arrayBuffer();
    
    yield {
      chunk: chunkBuffer,
      index: i,
      total: totalChunks
    };
  }
}

self.onmessage = async (e: MessageEvent<ChunkMessage>) => {
  const { type, data, id } = e.data;
  
  try {
    switch (type) {
      case 'hashChunk': {
        const hash = await hashChunk(data);
        self.postMessage({ type: 'hashChunkResult', id, data: hash } as ChunkResponse);
        break;
      }
      
      case 'hashFile': {
        const hash = await hashFile(data);
        self.postMessage({ type: 'hashFileResult', id, data: hash } as ChunkResponse);
        break;
      }
      
      case 'splitChunks': {
        const { file, chunkSize } = data;
        const totalChunks = Math.ceil(file.size / chunkSize);
        
        for await (const chunkData of splitIntoChunks(file, chunkSize)) {
          self.postMessage({
            type: 'chunk',
            id,
            data: {
              chunk: chunkData.chunk,
              index: chunkData.index,
              total: totalChunks
            }
          } as ChunkResponse);
        }
        
        self.postMessage({ type: 'done', id } as ChunkResponse);
        break;
      }
    }
  } catch (error) {
    self.postMessage({
      type: 'error',
      id,
      error: error instanceof Error ? error.message : 'Unknown error'
    } as ChunkResponse);
  }
};

export {};
