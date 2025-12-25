// 将 AudioBuffer 转换为 WAV 格式的函数
export const bufferToWave = (buffer: AudioBuffer, sampleRate: number): Blob => {
    const length = buffer.length;
    const numberOfChannels = buffer.numberOfChannels;
    const frameLength = numberOfChannels * length;
    const bufferLength = 44 + frameLength * 2; // 44 bytes 是 WAV 头部大小

    const arrayBuffer = new ArrayBuffer(bufferLength);
    const view = new DataView(arrayBuffer);

    // 创建 WAV 头部
    const writeString = (offset: number, string: string) => {
        for (let i = 0; i < string.length; i++) {
            view.setUint8(offset + i, string.charCodeAt(i));
        }
    };

    writeString(0, 'RIFF');
    view.setUint32(4, 36 + frameLength * 2, true);
    writeString(8, 'WAVE');
    writeString(12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, numberOfChannels, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * numberOfChannels * 2, true);
    view.setUint16(32, numberOfChannels * 2, true);
    view.setUint16(34, 16, true);
    writeString(36, 'data');
    view.setUint32(40, frameLength * 2, true);

    // 写入音频数据
    let offset = 44;
    for (let i = 0; i < length; i++) {
        for (let channel = 0; channel < numberOfChannels; channel++) {
            const sample = Math.max(-1, Math.min(1, buffer.getChannelData(channel)[i]));
            view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7FFF, true);
            offset += 2;
        }
    }

    return new Blob([view], {type: 'audio/wav'});
};

/**
 * 下载音频文件返回本地地址
 */
export const downloadAndStoreAudio = async (url: string, wordId: string): Promise<{
    dataUrl: string,
    objectUrl: string
} | null> => {
    try {
        const response = await fetch(url);
        const blob = await response.blob();

        // 存储到 localStorage (注意：localStorage 有大小限制)
        // const arrayBuffer = await blob.arrayBuffer();
        // const uint8Array = new Uint8Array(arrayBuffer);
        // localStorage.setItem(`audio_${wordId}`, JSON.stringify(Array.from(uint8Array)));


        // 创建一个音频上下文用于处理音频
        const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();

        // 读取音频数据
        const arrayBuffer = await blob.arrayBuffer();
        const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);

        // 降低音频质量以减小文件大小
        // 降低采样率到 22050Hz (标准是 44100Hz)
        const targetSampleRate = 22050;
        const offlineContext = new OfflineAudioContext(
            audioBuffer.numberOfChannels,
            (audioBuffer.duration * targetSampleRate) | 0,
            targetSampleRate
        );

        // 创建源节点
        const source = offlineContext.createBufferSource();
        source.buffer = audioBuffer;
        source.connect(offlineContext.destination);
        source.start();

        // 渲染降低采样率的音频
        const renderedBuffer = await offlineContext.startRendering();

        // 转换为 WAV 格式的 Blob
        const wavBlob = bufferToWave(renderedBuffer, targetSampleRate);

        // 存储到 localStorage (注意：localStorage 有大小限制)
        const wavArrayBuffer = await wavBlob.arrayBuffer();
        const uint8Array = new Uint8Array(wavArrayBuffer);
        localStorage.setItem(`audio_${wordId}`, JSON.stringify(Array.from(uint8Array)));


        // 同时存储到单词对象的 pronunciation 字段（base64编码）
        const reader = new FileReader();
        /*reader.onload = () => {
            wordModel.value.pronunciation = reader.result as string;
            // 更新数据库中的单词
            wordsStore.addAndUpdateWord(wordModel.value);
        };*/

        reader.readAsDataURL(blob);
        // 创建本地 URL
        return {
            dataUrl: reader.result as string,
            objectUrl: URL.createObjectURL(blob)
        };
    } catch (error) {
        console.error('Failed to download and store audio:', error);
        return null;
    }
};
