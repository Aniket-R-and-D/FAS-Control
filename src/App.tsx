import { useState, useEffect, useRef } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faQrcode,
  faTimes,
  faExclamationTriangle,
  faArrowLeft,
  faRedo,
} from '@fortawesome/free-solid-svg-icons';
import DeviceConnectionPortal from './components/DeviceConnectionPortal';
import { Html5Qrcode } from 'html5-qrcode';

const HestiaControlPanel = () => {
  const [isConnected, setIsConnected] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [espUrl, setEspUrl] = useState('');
  const [ipAddress, setIpAddress] = useState('192.168.4.74');
  const [port, setPort] = useState('8085');
  const [isRetrying, setIsRetrying] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [iframeLoading, setIframeLoading] = useState(true);
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const iframeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Cleanup scanner on unmount
  useEffect(() => {
    return () => {
      if (scannerRef.current) {
        scannerRef.current.stop().catch(() => { }); 
      }
      if (iframeTimerRef.current) {
        clearTimeout(iframeTimerRef.current);
      }
    };
  }, []);

  // Start html5-qrcode scanner
  const startScan = () => {
    setIsScanning(true);
  };

  // Initialize scanner when scanning view mounts
  useEffect(() => {
    if (!isScanning) return;

    const initScanner = async () => {
      try {
        const html5Qrcode = new Html5Qrcode('qr-reader');
        scannerRef.current = html5Qrcode;

        await html5Qrcode.start(
          { facingMode: 'environment' },
          {
            fps: 10,
            qrbox: { width: 250, height: 250 },
          },
          (decodedText) => {
            handleQrResult(decodedText);
          },
          () => {
            // QR code not detected — ignore
          }
        );
      } catch (err) {
        console.error('Camera error:', err);
        alert('Unable to access camera. Please check camera permissions.');
        stopScan();
      }
    };

    const timer = setTimeout(initScanner, 300);
    return () => clearTimeout(timer);
  }, [isScanning]);

  const [isScanError, setIsScanError] = useState(false);

  // ...

  const handleQrResult = (rawValue: string) => {
    let processedUrl = rawValue.trim();
    
    // 1. If no protocol, default to http://
    if (!processedUrl.startsWith('http://') && !processedUrl.startsWith('https://')) {
      processedUrl = 'http://' + processedUrl;
    }

    try {
      const url = new URL(processedUrl);
      const scannedIp = url.hostname;
      const scannedPort = url.port || (url.protocol === 'https:' ? '443' : '80');
      const scannedProtocol = url.protocol.replace(':', '');

      // Basic host validation
      if (!scannedIp) {
        throw new Error('No host found');
      }

      setIpAddress(scannedIp);
      setPort(scannedPort);

      // Auto-connect after short delay
      setTimeout(() => {
        stopScan();
        connectToDevice(scannedIp, scannedPort, scannedProtocol);
      }, 500);

    } catch (e) {
      stopScan();
      showError(
        'Invalid URL or QR format.\n\nExpected:\nhttp://IP_ADDRESS:PORT\n\nGot: ' + rawValue,
        true
      );
    }
  };

  const stopScan = async () => {
    if (scannerRef.current) {
      try {
        await scannerRef.current.stop();
      } catch (e) {
        // Ignore stop errors
      }
      scannerRef.current = null;
    }
    setIsScanning(false);
  };

  const showError = (msg: string, fromScan: boolean = false) => {
    setErrorMessage(msg);
    setHasError(true);
    setIsConnected(false);
    setEspUrl('');
    setIsScanError(fromScan);
  };

  const connectToDevice = async (ip: string, p: string, protocol: string = 'http') => {
    const portNum = parseInt(p, 10);
    if (isNaN(portNum) || portNum < 1 || portNum > 65535) {
      showError('Invalid port: ' + p + '\n\nPort must be between 1 and 65535');
      return;
    }

    const url = `${protocol}://${ip}:${p}`;

    // Show loading state
    setEspUrl(url);
    setHasError(false);
    setErrorMessage('');
    setIsScanError(false);
    setIframeLoading(true);
    setIsConnected(true);

    // Set a safety fallback timer to hide loading if onLoad never fires
    if (iframeTimerRef.current) clearTimeout(iframeTimerRef.current);
    iframeTimerRef.current = setTimeout(() => {
      setIframeLoading(false);
    }, 5000);
  };

  const handleIframeLoad = () => {
    if (iframeTimerRef.current) {
      clearTimeout(iframeTimerRef.current);
    }
    setIframeLoading(false);
  };

  const handleIframeError = () => {
    if (iframeTimerRef.current) {

      clearTimeout(iframeTimerRef.current);
    }
    showError(
      'Could not reach the web server at:\n' +
      espUrl +
      '\n\nPlease check:\n• The IP address and port are correct\n• Your phone is on the same WiFi\n• The device is powered on'
    );
  };

  const handleConnect = () => {
    if (!ipAddress || !port) {
      showError('Please enter both IP address and port.');
      return;
    }

    setIsRetrying(true);
    setTimeout(() => {
      let manualIp = ipAddress.trim();
      let manualProtocol = 'http';

      if (manualIp.startsWith('https://')) {
        manualProtocol = 'https';
        manualIp = manualIp.replace('https://', '');
      } else if (manualIp.startsWith('http://')) {
        manualProtocol = 'http';
        manualIp = manualIp.replace('http://', '');
      }

      connectToDevice(manualIp, port, manualProtocol);
      setIsRetrying(false);
    }, 300);
  };

  const handleDisconnect = () => {
    const confirmed = window.confirm('Disconnect from Hestia device?');
    if (confirmed) {
      setEspUrl('');
      setIsConnected(false);
      setHasError(false);
      setErrorMessage('');
      setIsScanError(false);
    }
  };

  const goBack = () => {
    setHasError(false);
    setErrorMessage('');
    setIsConnected(false);
    setEspUrl('');
    setIsScanError(false);
  };

  // ═══════════════════════════════
  // Screen: QR Scanner Modal
  // ═══════════════════════════════
  if (isScanning) {
    return (
      <div className="fixed inset-0 bg-black z-50 flex flex-col">
        <div className="bg-black/80 px-6 pt-10 pb-4 text-center">
          <h2 className="text-white text-xl font-bold flex items-center justify-center gap-2">
            <FontAwesomeIcon icon={faQrcode} className="text-white/80" />
            Scan QR Code
          </h2>
          <p className="text-gray-400 text-sm mt-2">Point camera at Hestia device QR code</p>
        </div>

        <div className="flex-1 relative flex items-center justify-center bg-black">
          <div id="qr-reader" className="w-full max-w-sm" />
        </div>

        <div className="bg-black/80 px-6 py-5">
          <button
            onClick={stopScan}
            className="w-full py-4 rounded-xl bg-[#ef4444] hover:bg-[#dc2626] text-white font-bold text-lg shadow-lg active:scale-[0.97] transition-all flex items-center justify-center gap-2"
          >
            <FontAwesomeIcon icon={faTimes} />
            Close Scanner
          </button>
        </div>
      </div>
    );
  }

  // ═══════════════════════════════
  // Screen: Error State
  // ═══════════════════════════════
  if (hasError) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-[#F5F7FA] z-50 p-6">
        <div className="w-full max-w-sm">
          <div className="bg-white border border-slate-200 rounded-lg shadow-lg overflow-hidden">
            {/* Error Header */}
            <div className="bg-[#ef4444] px-4 py-2 flex items-center justify-between">
              <span className="text-white text-[10px] font-bold uppercase tracking-widest">System Alert</span>
              <FontAwesomeIcon icon={faExclamationTriangle} className="text-white text-xs" />
            </div>

            <div className="p-8 text-center">
              <div className="mb-6 inline-flex items-center justify-center w-16 h-16 rounded-full bg-red-50">
                <FontAwesomeIcon icon={faExclamationTriangle} className="text-2xl text-[#ef4444]" />
              </div>

              <h2 className="text-lg font-bold text-[#252F3D] mb-3">Connection Failure</h2>
              <p className="text-xs text-slate-500 whitespace-pre-line leading-relaxed mb-8 px-2">
                {errorMessage}
              </p>

              <div className="space-y-3">
                <button
                  onClick={() => {
                    setHasError(false);
                    setErrorMessage('');
                    if (isScanError) {
                      startScan();
                    } else {
                      connectToDevice(ipAddress, port);
                    }
                  }}
                  className="w-full py-3 rounded bg-[#252F3D] text-white font-bold text-sm active:scale-[0.98] transition-all flex items-center justify-center gap-2 shadow-md"
                >
                  <FontAwesomeIcon icon={isScanError ? faQrcode : faRedo} />
                  {isScanError ? 'RETRY DISCOVERY' : 'RETRY CONNECTION'}
                </button>

                <button
                  onClick={goBack}
                  className="w-full py-3 rounded border border-slate-200 bg-white text-slate-600 font-bold text-sm active:scale-[0.98] transition-all flex items-center justify-center gap-2"
                >
                  <FontAwesomeIcon icon={faArrowLeft} />
                  ABORT & RETURN
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ═══════════════════════════════
  // Screen: Connected — ESP32 Webserver
  // ═══════════════════════════════
  if (isConnected && espUrl) {
    return (
      <div className="fixed inset-0 flex flex-col overflow-hidden bg-[#F5F7FA]">
        {/* ThingsBoard Top Bar */}
        <div className="flex-none bg-[#252F3D] text-white px-4 pt-[calc(0.75rem+env(safe-area-inset-top))] pb-3 shadow-md z-50">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="relative flex items-center justify-center">
                <div className="absolute w-2.5 h-2.5 bg-[#4CAF50] rounded-full animate-ping opacity-60" />
                <div className="relative w-2 h-2 bg-[#4CAF50] rounded-full" />
              </div>
              <span className="text-sm font-bold tracking-tight">SEPLE Connect</span>
              <span className="hidden xs:inline-block bg-[#52B5A2] text-[9px] font-bold px-1.5 py-0.5 rounded uppercase">
                Linked
              </span>
            </div>

            <button
              onClick={handleDisconnect}
              className="px-3 py-1.5 bg-[#ef4444] hover:bg-[#dc2626] rounded text-[10px] font-bold uppercase tracking-wider transition-all active:scale-[0.95] shadow-sm"
            >
              Terminate
            </button>
          </div>
        </div>

        {/* Full Screen iframe */}
        <div className="flex-1 relative bg-white">
          {iframeLoading && (
            <div className="absolute top-0 left-0 right-0 h-1 z-20">
              <div className="h-full bg-[#52B5A2] animate-pulse shadow-[0_0_8px_rgba(82,181,162,0.8)]" />
            </div>
          )}
          <iframe
            src={espUrl}
            className="w-full h-full border-none"
            title="ESP32 Web Server"
            onLoad={handleIframeLoad}
            onError={handleIframeError}
          />
        </div>
      </div>
    );
  }

  // ═══════════════════════════════
  // Screen: Connection Portal
  // ═══════════════════════════════
  return (
    <DeviceConnectionPortal
      ipAddress={ipAddress}
      setIpAddress={setIpAddress}
      port={port}
      setPort={setPort}
      isRetrying={isRetrying}
      handleConnect={handleConnect}
      startScan={startScan}
    />
  );
};

export default HestiaControlPanel;