declare module '*.svg' {
    const content: string;
    export default content;
}

interface Window {
    AndroidBridge?: {
        open: (url: string) => void;
        close: () => void;
    };
}
