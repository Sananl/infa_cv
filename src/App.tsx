import { useState, useEffect, useRef } from 'react';
import {
  Shield,
  Activity,
  Layers,
  Terminal,
  GitBranch,
  RefreshCw,
  AlertTriangle,
  Server,
  Settings,
  Globe,
  Lock,
  Wifi,
  Check,
  Cpu,
  Clock,
  ArrowRight,
  Database,
  X
} from 'lucide-react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip as ChartTooltip
} from 'recharts';

// TypeScript interfaces
interface MetricPoint {
  time: string;
  requests: number;
  wafBlocks: number;
}

interface LogEntry {
  id: string;
  timestamp: string;
  ip: string;
  method: string;
  path: string;
  status: number;
  wafStatus: 'PASS' | 'BLOCKED';
  wafRule?: string;
  geo: string;
  userAgent?: string;
}

interface ServerMetrics {
  id: number;
  name: string;
  role: string;
  cpu: number;
  ram: number;
  status: 'healthy' | 'warning' | 'crashed';
  uptime: string;
  ip: string;
  historyCpu: number[];
}

interface PodInfo {
  id: string;
  name: string;
  status: 'Running' | 'Pending' | 'CrashLoopBackOff';
  cpu: number;
  mem: number;
  restarts: number;
  namespace: 'default' | 'kube-system' | 'ingress';
}

interface TimelineEvent {
  id: string;
  timestamp: string;
  type: 'commit' | 'deploy' | 'alert' | 'redeploying';
  title: string;
  subtitle: string;
  status: 'success' | 'failed' | 'pending' | 'critical';
  commitHash?: string;
  author?: string;
  actionRequired?: boolean;
}

interface TraceSpan {
  name: string;
  service: string;
  durationMs: number;
  startOffsetMs: number;
  status: 'success' | 'error';
  info: string;
}

export default function App() {
  // --- STATE ---
  const [isFailureSimulated, setIsFailureSimulated] = useState(false);
  const [isRedeploying, setIsRedeploying] = useState(false);
  const [redeployProgress, setRedeployProgress] = useState(0);

  // Real Connection & Upstream Status
  const [isNginxOffline, setIsNginxOffline] = useState(false);
  const [servedByNode, setServedByNode] = useState<string>('Detecting Upstream...');
  const fetchFailureCount = useRef(0);

  // Distributed Tracing State (OpenTelemetry modal)
  const [selectedLogForTrace, setSelectedLogForTrace] = useState<LogEntry | null>(null);

  // Traffic generation states (for UI visual feedback)
  const [trafficMode, setTrafficMode] = useState<'idle' | 'normal' | 'attack'>('idle');

  // Time & Uptime
  const [systemTime, setSystemTime] = useState<string>('');
  const [systemUptime] = useState<string>('14d 06h 32m 11s');

  // Chart Telemetry History (last 16 points)
  const [chartData, setChartData] = useState<MetricPoint[]>([]);

  // Real Logs
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const lastProcessedLogCount = useRef<number>(0);
  const logContainerRef = useRef<HTMLDivElement>(null);

  // Servers (Infra Layer 3/4)
  const [servers, setServers] = useState<ServerMetrics[]>([
    { id: 1, name: 'api-srv-primary', role: 'API Gateway', cpu: 32, ram: 54, status: 'healthy', uptime: '14d 06h', ip: '10.0.1.12', historyCpu: [30, 32, 28, 35, 32] },
    { id: 2, name: 'auth-broker-02', role: 'Session Store', cpu: 22, ram: 41, status: 'healthy', uptime: '31d 12h', ip: '10.0.1.13', historyCpu: [20, 25, 21, 24, 22] },
    { id: 3, name: 'k8s-worker-node-3', role: 'Pod Host (Large)', cpu: 45, ram: 68, status: 'healthy', uptime: '08d 19h', ip: '10.0.2.45', historyCpu: [40, 48, 43, 47, 45] }
  ]);

  // Pods (Kubernetes Grid)
  const [pods, setPods] = useState<PodInfo[]>([
    { id: 'p1', name: 'ingress-nginx-6df', status: 'Running', cpu: 12, mem: 45, restarts: 0, namespace: 'ingress' },
    { id: 'p2', name: 'auth-api-5c4d2', status: 'Running', cpu: 24, mem: 120, restarts: 1, namespace: 'default' },
    { id: 'p3', name: 'auth-api-5c4d5', status: 'Running', cpu: 18, mem: 112, restarts: 0, namespace: 'default' },
    { id: 'p4', name: 'payment-srv-9b2f', status: 'Running', cpu: 35, mem: 245, restarts: 0, namespace: 'default' },
    { id: 'p5', name: 'payment-srv-9b2g', status: 'Running', cpu: 41, mem: 250, restarts: 2, namespace: 'default' },
    { id: 'p6', name: 'user-profile-2a8', status: 'Running', cpu: 8, mem: 88, restarts: 0, namespace: 'default' },
    { id: 'p7', name: 'db-proxy-ef88', status: 'Running', cpu: 15, mem: 160, restarts: 0, namespace: 'default' },
    { id: 'p8', name: 'db-proxy-ef89', status: 'Running', cpu: 14, mem: 158, restarts: 0, namespace: 'default' },
    { id: 'p9', name: 'search-index-1w', status: 'Running', cpu: 52, mem: 512, restarts: 0, namespace: 'default' },
    { id: 'p10', name: 'cache-redis-0', status: 'Running', cpu: 9, mem: 340, restarts: 0, namespace: 'default' },
    { id: 'p11', name: 'metric-collector', status: 'Running', cpu: 28, mem: 198, restarts: 0, namespace: 'kube-system' },
    { id: 'p12', name: 'dns-resolver-7a', status: 'Running', cpu: 4, mem: 32, restarts: 0, namespace: 'kube-system' },
  ]);

  // Timeline (CI/CD)
  const [timeline, setTimeline] = useState<TimelineEvent[]>([
    {
      id: 't1',
      timestamp: '12:15:30',
      type: 'deploy',
      title: 'Load Balanced Build v2.5.0 [Upstream Active]',
      subtitle: 'Deployment Successful • Round-Robin Active Across 2 Web Nodes',
      status: 'success'
    },
    {
      id: 't2',
      timestamp: '12:00:15',
      type: 'commit',
      title: 'feat: add docker-compose with multi-service load balancer upstream config',
      subtitle: 'Branch: main • Author: alex.dev (commit d8f8a1e)',
      status: 'success',
      commitHash: 'd8f8a1e',
      author: 'alex.dev'
    }
  ]);

  // --- LOCAL CLOCK SETUP ---
  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setSystemTime(now.toTimeString().split(' ')[0]);
    };
    updateTime();
    const clockInterval = setInterval(updateTime, 1000);

    // Initial Chart Data (baseline values)
    const initialData: MetricPoint[] = [];
    const nowMs = Date.now();
    for (let i = 15; i >= 0; i--) {
      const t = new Date(nowMs - i * 5000);
      initialData.push({
        time: t.toTimeString().split(' ')[0].substring(3, 8),
        requests: 0,
        wafBlocks: 0
      });
    }
    setChartData(initialData);

    return () => clearInterval(clockInterval);
  }, []);

  // --- FETCH REAL NGINX ACCESS LOGS ---
  const fetchRealLogs = async () => {
    try {
      const res = await fetch(`/logs/access.log?cb=${Date.now()}`, { cache: 'no-store' });
      if (!res.ok) throw new Error("Access log file missing or unreachable.");
      
      const text = await res.text();
      
      // Reset connection failure status
      fetchFailureCount.current = 0;
      setIsNginxOffline(false);

      // Split into lines
      const lines = text.split('\n').filter(line => line.trim().length > 0);
      const totalLines = lines.length;

      // Extract only the new lines since the last check
      const newLinesCount = totalLines - lastProcessedLogCount.current;
      
      let newRequestsCount = 0;
      let newBlocksCount = 0;

      const parsedEntries: LogEntry[] = [];

      // Parse the last 25 lines to avoid memory flooding, but count new metrics correctly
      const linesToParse = lines.slice(-25);
      linesToParse.forEach((line) => {
        const entry = parseNginxLogLine(line);
        if (entry) {
          parsedEntries.push(entry);
        }
      });

      // Count actual requests and blocks in the new lines segment
      if (newLinesCount > 0) {
        const newLines = lines.slice(-newLinesCount);
        newLines.forEach(line => {
          const match = line.match(/"(GET|POST|PUT|DELETE|HEAD) (.*?) HTTP\/.*?" (\d+)/);
          if (match) {
            newRequestsCount++;
            const status = parseInt(match[3], 10);
            if (status === 403) {
              newBlocksCount++;
            }
          }
        });
      }

      // Update ref count
      lastProcessedLogCount.current = totalLines;

      // Update logs in state
      if (parsedEntries.length > 0) {
        setLogs(parsedEntries);
      }

      // Update Chart Telemetry with real rates
      const timeStr = new Date().toTimeString().split(' ')[0].substring(3, 8);
      setChartData(prev => {
        const tps = Math.round(newRequestsCount / 2); 
        const blocks = Math.round(newBlocksCount / 2);

        const reqRate = newRequestsCount > 0 ? tps : Math.floor(Math.random() * 2) + 1;
        const blockRate = newBlocksCount > 0 ? blocks : 0;

        const next = [...prev, { time: timeStr, requests: reqRate, wafBlocks: blockRate }];
        if (next.length > 16) next.shift();
        return next;
      });

    } catch (e) {
      fetchFailureCount.current++;
      if (fetchFailureCount.current >= 2) {
        setIsNginxOffline(true);
      }
      console.warn("Failed to fetch real Nginx access logs:", e);
    }
  };

  // Helper to parse Nginx logs
  const parseNginxLogLine = (line: string): LogEntry | null => {
    // regex matching IP, timestamp, method, path, status, size, referer, useragent
    const match = line.match(/^([\d.]+|localhost) \S+ \S+ \[(.*?)\] "(GET|POST|PUT|DELETE|HEAD|OPTIONS|PATCH) (.*?) HTTP\/.*?" (\d+) (\d+) "(.*?)" "(.*?)"/);
    if (!match) return null;

    const [, ip, timestampStr, method, path, statusStr, , , ua] = match;
    const status = parseInt(statusStr, 10);
    
    // Extract HH:MM:SS
    let timeOnly = timestampStr;
    const timeMatch = timestampStr.match(/:(\d{2}:\d{2}:\d{2})/);
    if (timeMatch) {
      timeOnly = timeMatch[1];
    }

    // Classify block based on status code 403
    const wafStatus = status === 403 ? 'BLOCKED' : 'PASS';
    const wafRule = status === 403 ? 'WAF Block Rule #403: Forbidden Action Target' : undefined;

    // Detect Geo mapping
    let geo = 'WAN-ROUTER';
    if (ip === '127.0.0.1' || ip === 'localhost') {
      geo = 'LOCAL-NOC';
    } else if (ip.startsWith('172.')) {
      geo = 'DOCKER-NET';
    } else if (ip.startsWith('10.')) {
      geo = 'INTRANET-VPC';
    }

    return {
      id: Math.random().toString(36).substring(7),
      timestamp: timeOnly,
      ip: ip === '127.0.0.1' ? '127.0.0.1 (Localhost)' : ip,
      method,
      path: path.split('?')[0], // strip cache-buster parameter in UI logs for readability
      status,
      wafStatus,
      wafRule,
      geo,
      userAgent: ua
    };
  };

  // Upstream Node Verification
  const checkServedByNode = async () => {
    if (isNginxOffline) return;
    try {
      const res = await fetch(`/?cb=${Date.now()}-${Math.random()}`, { method: 'GET', cache: 'no-store' });
      const node = res.headers.get('X-Upstream-Address');
      if (node) {
        setServedByNode(node);
      }
    } catch (e) {
      console.warn("Failed to detect active upstream node:", e);
    }
  };

  // Run fetch loop every 2 seconds
  useEffect(() => {
    fetchRealLogs();
    const logInterval = setInterval(fetchRealLogs, 2000);
    return () => clearInterval(logInterval);
  }, []);

  // Run upstream checker every 3 seconds
  useEffect(() => {
    checkServedByNode();
    const upstreamInterval = setInterval(checkServedByNode, 3000);
    return () => clearInterval(upstreamInterval);
  }, [isNginxOffline]);

  // --- TRAFFIC INJECTORS (BROWSER SIDE) ---
  const triggerClientTraffic = async (mode: 'normal' | 'attack') => {
    if (trafficMode !== 'idle') return;
    setTrafficMode(mode);

    if (mode === 'attack') {
      const attackAlertEvent: TimelineEvent = {
        id: Math.random().toString(),
        timestamp: new Date().toTimeString().split(' ')[0],
        type: 'alert',
        title: 'WAF BLOCKED CRITICAL THREAT (Layer 7)',
        subtitle: 'Suspicious payload injected to /api/block-me. HTTP 403 triggered.',
        status: 'critical',
        actionRequired: true
      };
      setTimeline(prev => [attackAlertEvent, ...prev]);
    }

    let count = 0;
    const maxRequests = mode === 'attack' ? 45 : 30;
    
    const interval = setInterval(async () => {
      if (count >= maxRequests) {
        clearInterval(interval);
        setTrafficMode('idle');
        checkServedByNode();
        return;
      }

      try {
        const cacheBuster = `cb=${Date.now()}-${Math.random()}`;

        if (mode === 'attack') {
          await fetch(`/api/block-me?${cacheBuster}&sql_payload=UNION+SELECT+admin_pass`, { cache: 'no-store' });
        } else {
          const routes = ['/', '/api/v1/users', '/index.html', '/favicon.svg'];
          const route = routes[Math.floor(Math.random() * routes.length)];
          const separator = route.includes('?') ? '&' : '?';
          await fetch(`${route}${separator}${cacheBuster}`, { cache: 'no-store' });
        }
      } catch (e) {
        // ignore errors
      }
      count++;
    }, 120);
  };

  // --- RUNTIME SIMULATIONS ---
  useEffect(() => {
    const interval = setInterval(() => {
      setServers(prev => {
        return prev.map(srv => {
          if (srv.id === 3 && isFailureSimulated) {
            return { ...srv, cpu: 0, ram: 0, status: 'crashed', historyCpu: [...srv.historyCpu.slice(1), 0] };
          }
          let factor = trafficMode === 'attack' ? 1.7 : trafficMode === 'normal' ? 1.3 : 1.0;
          let newCpu = Math.min(99, Math.max(5, Math.floor((Math.random() * 12 + (srv.id === 1 ? 30 : srv.id === 2 ? 22 : 45)) * factor)));
          let newRam = Math.min(99, Math.max(5, Math.floor((Math.random() * 5 + (srv.id === 1 ? 54 : srv.id === 2 ? 41 : 68)) * (factor * 0.95))));
          return {
            ...srv,
            cpu: newCpu,
            ram: newRam,
            status: newCpu > 80 || newRam > 80 ? 'warning' : 'healthy',
            historyCpu: [...srv.historyCpu.slice(1), newCpu]
          };
        });
      });

      setPods(prev => {
        return prev.map((pod, idx) => {
          if (isFailureSimulated && (idx === 3 || idx === 4 || idx === 8)) {
            return { ...pod, status: 'CrashLoopBackOff', cpu: 0, mem: 0, restarts: pod.restarts + (Math.random() > 0.9 ? 1 : 0) };
          }
          if (isRedeploying && pod.status === 'CrashLoopBackOff') {
            return { ...pod, status: 'Pending', cpu: 1, mem: 40 };
          }
          let cpuVar = Math.max(2, pod.cpu + Math.floor(Math.random() * 4) - 2);
          if (trafficMode === 'attack') cpuVar = Math.min(95, cpuVar * 1.4);
          return {
            ...pod,
            cpu: pod.status === 'Running' ? cpuVar : pod.cpu,
          };
        });
      });
    }, 2000);

    return () => clearInterval(interval);
  }, [isFailureSimulated, isRedeploying, trafficMode]);

  // Scroll access logs container automatically
  useEffect(() => {
    if (logContainerRef.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
    }
  }, [logs]);

  const handleSimulateFailure = () => {
    if (isFailureSimulated) {
      setIsFailureSimulated(false);
      setServers(prev => prev.map(s => s.id === 3 ? { ...s, status: 'healthy', cpu: 45, ram: 65 } : s));
      setPods(prev => prev.map(p => p.status === 'CrashLoopBackOff' ? { ...p, status: 'Running', cpu: 20 } : p));
      return;
    }

    setIsFailureSimulated(true);

    const crashEvent: TimelineEvent = {
      id: Math.random().toString(),
      timestamp: new Date().toTimeString().split(' ')[0],
      type: 'alert',
      title: 'NODE FAILURE: k8s-worker-node-3 offline',
      subtitle: '3 container pods crashed. CPU telemetry flatlined. Action required.',
      status: 'critical',
      actionRequired: true
    };
    setTimeline(prev => [crashEvent, ...prev]);
  };

  const handleRedeploy = () => {
    if (isRedeploying) return;
    setIsRedeploying(true);
    setRedeployProgress(5);

    const deployEvent: TimelineEvent = {
      id: 'redeploy-event',
      timestamp: new Date().toTimeString().split(' ')[0],
      type: 'redeploying',
      title: 'Rollout & Pod Rescheduling Initiated',
      subtitle: 'Re-routing ingress, launching v2.5.1 stabilization build...',
      status: 'pending'
    };
    setTimeline(prev => [deployEvent, ...prev]);

    const interval = setInterval(() => {
      setRedeployProgress(p => {
        if (p >= 100) {
          clearInterval(interval);
          setTimeout(() => {
            setIsRedeploying(false);
            setIsFailureSimulated(false);

            setServers(prev => prev.map(s => ({
              ...s,
              status: 'healthy',
              cpu: Math.floor(Math.random() * 20) + 30,
              ram: Math.floor(Math.random() * 15) + 40
            })));

            setPods(prev => prev.map(pod => ({
              ...pod,
              status: 'Running',
              cpu: Math.floor(Math.random() * 15) + 10,
              restarts: pod.status === 'CrashLoopBackOff' ? pod.restarts + 1 : pod.restarts
            })));

            setTimeline(prev => {
              const filtered = prev.filter(e => e.id !== 'redeploy-event' && !e.actionRequired);
              const successEvent: TimelineEvent = {
                id: Math.random().toString(),
                timestamp: new Date().toTimeString().split(' ')[0],
                type: 'deploy',
                title: 'System Restored & Redeployed Successfully',
                subtitle: 'v2.5.1 deployed. Load averages stabilized. Threat resolved.',
                status: 'success'
              };
              return [successEvent, ...filtered];
            });

          }, 500);
          return 100;
        }
        return p + 20;
      });
    }, 300);
  };

  // --- MERGE DISTRIBUTED TRACING SPANS SIMULATION ---
  const generateSpansForLog = (log: LogEntry): TraceSpan[] => {
    const isWafBlock = log.wafStatus === 'BLOCKED';
    
    // Normal delays or error delays
    const networkDelay = 2;
    const proxyDelay = isWafBlock ? 1 : 3;
    const appDelay = isWafBlock ? 0 : log.status === 404 ? 4 : 12;
    const dbDelay = isWafBlock || log.status === 404 ? 0 : 8;

    const spans: TraceSpan[] = [
      {
        name: `${log.method} ${log.path}`,
        service: 'client-ingress-router',
        durationMs: networkDelay + proxyDelay + appDelay + dbDelay + 3,
        startOffsetMs: 0,
        status: log.status >= 400 ? 'error' : 'success',
        info: `Client Request from ${log.ip} (${log.geo})`
      },
      {
        name: 'Proxy Route Request',
        service: 'nginx-load-balancer',
        durationMs: proxyDelay + appDelay + dbDelay + 1,
        startOffsetMs: networkDelay,
        status: isWafBlock ? 'error' : 'success',
        info: isWafBlock 
          ? `Blocked by WAF policy rules. Rejected with HTTP 403.` 
          : `Forwarded via upstream group [web_servers] to ${servedByNode}`
      }
    ];

    if (!isWafBlock) {
      spans.push({
        name: 'Serve Application Assets',
        service: 'app-backend-node',
        durationMs: appDelay + dbDelay,
        startOffsetMs: networkDelay + proxyDelay,
        status: log.status === 404 ? 'error' : 'success',
        info: log.status === 404 
          ? `Path not found inside Nginx docroot. Responded HTTP 404.` 
          : `Rendered client-side HTML bundle. Active node host: ${servedByNode}`
      });

      if (log.status !== 404) {
        spans.push({
          name: 'Query Session Store',
          service: 'redis-session-store',
          durationMs: 2,
          startOffsetMs: networkDelay + proxyDelay + 2,
          status: 'success',
          info: `Validated user profile cache session. Hit rate: 100%`
        });

        spans.push({
          name: 'SELECT user_credentials',
          service: 'postgres-database-query',
          durationMs: dbDelay,
          startOffsetMs: networkDelay + proxyDelay + appDelay - dbDelay,
          status: 'success',
          info: `Resolved user role mapping table. DB query latency: ${dbDelay}ms`
        });
      }
    }

    return spans;
  };

  const activeThreatLevel = trafficMode === 'attack' ? 'CRITICAL' : isFailureSimulated ? 'ELEVATED' : 'STABLE';
  const runningPodsCount = pods.filter(p => p.status === 'Running').length;
  const clusterHealthScore = Math.floor((runningPodsCount / pods.length) * 100);

  const currentTps = chartData.length > 0 ? chartData[chartData.length - 1].requests : 0;
  const currentBlocks = chartData.length > 0 ? chartData[chartData.length - 1].wafBlocks : 0;

  return (
    <div className="relative min-h-screen dot-matrix p-4 md:p-6 lg:p-8 flex flex-col gap-6 selection:bg-cyber-blue/30 selection:text-white">
      <div className="scanline" />

      {/* HEADER SECTION */}
      <header className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 border-b border-cyber-blue/20 pb-6">
        <div>
          <div className="flex items-center gap-3">
            <div className="relative flex items-center justify-center">
              <span className={`absolute inline-flex h-3 w-3 rounded-full ${
                isFailureSimulated || isNginxOffline ? 'bg-cyber-red animate-ping' : 'bg-cyber-green animate-ping'
              }`} />
              <span className={`relative inline-flex rounded-full h-3.5 w-3.5 ${
                isFailureSimulated || isNginxOffline ? 'bg-cyber-red glow-red' : 'bg-cyber-green glow-green'
              }`} />
            </div>
            <h1 className="text-2xl font-bold font-mono tracking-wider bg-gradient-to-r from-slate-50 via-slate-200 to-cyber-blue bg-clip-text text-transparent">
              OP-CENTER // OBSERVABILITY
            </h1>
            <span className="hidden md:inline text-xs border border-cyber-blue/30 text-cyber-blue px-2 py-0.5 rounded font-mono uppercase bg-cyber-blue/5">
              ACTIVE NODE: {isNginxOffline ? 'OFFLINE' : servedByNode}
            </span>
          </div>
          <p className="text-xs md:text-sm text-slate-400 mt-1 font-mono">
            GATEWAY NODE STATE: <span className={isFailureSimulated || isNginxOffline ? 'text-cyber-red font-semibold' : 'text-cyber-green font-semibold'}>
              {isNginxOffline ? 'GATEWAY OFFLINE (DISCONNECTED)' : isFailureSimulated ? 'DEGRADED PERFORMANCE' : 'ALL SYSTEMS OPERATIONAL'}
            </span>
          </p>
        </div>

        {/* Global Controls */}
        <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto">
          {/* Traffic Injectors */}
          <div className="flex items-center gap-2 bg-slate-950/85 border border-cyber-blue/20 rounded-lg p-1.5 mr-0 lg:mr-2">
            <span className="text-[9px] font-mono text-slate-500 px-1">TRAFFIC INJECT:</span>
            <button
              onClick={() => triggerClientTraffic('normal')}
              disabled={trafficMode !== 'idle' || isNginxOffline}
              className={`px-2.5 py-1 rounded text-[10px] font-bold font-mono tracking-tight transition-colors border ${
                trafficMode === 'normal'
                  ? 'bg-cyber-blue/20 border-cyber-blue text-cyber-blue'
                  : isNginxOffline 
                  ? 'text-slate-600 border-transparent cursor-not-allowed bg-slate-950'
                  : 'text-slate-400 hover:text-slate-200 border-transparent bg-slate-900/60 hover:bg-slate-900'
              }`}
            >
              NORMAL (GET)
            </button>
            <button
              onClick={() => triggerClientTraffic('attack')}
              disabled={trafficMode !== 'idle' || isNginxOffline}
              className={`px-2.5 py-1 rounded text-[10px] font-bold font-mono tracking-tight transition-colors border ${
                trafficMode === 'attack'
                  ? 'bg-cyber-red/20 border-cyber-red text-cyber-red'
                  : isNginxOffline 
                  ? 'text-slate-600 border-transparent cursor-not-allowed bg-slate-950'
                  : 'text-slate-400 hover:text-slate-200 border-transparent bg-slate-900/60 hover:bg-slate-900'
              }`}
            >
              ATTACK (403 WAF)
            </button>
          </div>

          <div className="flex items-center gap-2 bg-slate-950/80 border border-slate-800 rounded-lg p-1.5 mr-0 lg:mr-2">
            <button
              onClick={handleSimulateFailure}
              disabled={isNginxOffline}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-semibold font-mono tracking-tight transition-colors ${
                isFailureSimulated
                  ? 'bg-cyber-yellow/20 border border-cyber-yellow text-cyber-yellow'
                  : isNginxOffline 
                  ? 'text-slate-600 cursor-not-allowed'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900 border border-transparent'
              }`}
            >
              <AlertTriangle className={`h-3.5 w-3.5 ${isFailureSimulated ? 'animate-bounce' : ''}`} />
              {isFailureSimulated ? 'RESOLVE CRASH' : 'SIMULATE CRASH'}
            </button>
          </div>

          <div className="flex items-center gap-4 bg-slate-950/60 border border-cyber-blue/15 rounded-lg px-4 py-2 text-xs font-mono text-slate-300">
            <div className="hidden sm:block border-r border-slate-800 pr-4">
              <span className="text-slate-500 block text-[10px]">UPTIME</span>
              <span>{systemUptime}</span>
            </div>
            <div>
              <span className="text-slate-500 block text-[10px]">LOCAL TIME</span>
              <span className="text-cyber-blue font-bold tracking-widest">{systemTime || '00:00:00'}</span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button className="p-2 text-slate-400 hover:text-cyber-blue bg-slate-900/60 hover:bg-slate-900 border border-slate-800 hover:border-cyber-blue/30 rounded-lg transition-colors">
              <Settings className="h-4 w-4" />
            </button>
            <div className="flex items-center gap-2 pl-2 pr-3 py-1.5 text-slate-300 bg-slate-900/60 border border-slate-800 rounded-lg">
              <div className="h-5 w-5 rounded-full bg-cyber-blue/20 border border-cyber-blue/40 flex items-center justify-center text-[10px] text-cyber-blue font-bold">
                AG
              </div>
              <span className="text-xs font-mono font-medium hidden sm:inline">sys.admin</span>
            </div>
          </div>
        </div>
      </header>

      {/* REAL NGINX CONNECTION FAIL ALERTS */}
      {isNginxOffline && (
        <div className="bg-cyber-red/10 border-l-4 border-cyber-red text-cyber-red px-4 py-3 rounded-r-lg flex items-center gap-3 animate-pulse">
          <AlertTriangle className="h-5 w-5 flex-shrink-0" />
          <div>
            <span className="font-bold font-mono">⚠️ INGRESS GATEWAY DISCONNECTED //</span>
            <span className="ml-1 text-slate-200">
              Cannot establish connection to Nginx load balancer. The upstream nodes are unreachable.
            </span>
          </div>
        </div>
      )}

      {/* SYSTEM CRASH SIMULATION ALERTS */}
      {isFailureSimulated && !isNginxOffline && (
        <div className="bg-cyber-red/10 border-l-4 border-cyber-red text-cyber-red px-4 py-3 rounded-r-lg flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 animate-pulse">
          <div className="flex items-center gap-3">
            <AlertTriangle className="h-5 w-5 flex-shrink-0" />
            <div>
              <span className="font-bold font-mono">NODE CRITICAL FAIL //</span>
              <span className="ml-1 text-slate-200">Server [k8s-worker-node-3] has failed metrics. Ingress requests to associated pods are receiving 502 Bad Gateway.</span>
            </div>
          </div>
          <button
            onClick={handleRedeploy}
            disabled={isRedeploying}
            className="flex items-center gap-1.5 bg-cyber-red hover:bg-cyber-red/90 text-white font-mono font-bold text-xs uppercase px-4 py-2 rounded shadow-lg shadow-cyber-red/20 transition-all border border-cyber-red active:scale-95"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isRedeploying ? 'animate-spin' : ''}`} />
            {isRedeploying ? `Deploying... ${redeployProgress}%` : 'REDEPLOY STABLE BUILDS'}
          </button>
        </div>
      )}

      {/* TOP GLOWING METRIC SUMMARIES */}
      <section className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          {
            title: 'WAF FIREWALL SECURITY',
            value: isNginxOffline ? 'DISCONNECTED' : trafficMode === 'attack' ? 'ACTIVE BLOCKED' : 'PASSIVE MONITOR',
            icon: Shield,
            statusColor: isNginxOffline ? 'text-slate-500' : trafficMode === 'attack' ? 'text-cyber-red' : 'text-cyber-green',
            glow: isNginxOffline ? 'bg-slate-950/20 border-slate-900' : trafficMode === 'attack' ? 'glow-red bg-cyber-red/5 border-cyber-red/35' : 'glow-green bg-cyber-green/5 border-cyber-green/20',
            desc: isNginxOffline ? 'Offline' : `Current WAF Drop: ${currentBlocks}/sec`
          },
          {
            title: 'INGRESS TRAFFIC THROUGHPUT',
            value: isNginxOffline ? '0 TPS' : `${currentTps} TPS`,
            icon: Activity,
            statusColor: isNginxOffline ? 'text-slate-500' : trafficMode === 'attack' ? 'text-cyber-yellow' : 'text-cyber-blue',
            glow: isNginxOffline ? 'bg-slate-950/20 border-slate-900' : trafficMode === 'attack' ? 'glow-yellow bg-cyber-yellow/5 border-cyber-yellow/30' : 'glow-blue bg-cyber-blue/5 border-cyber-blue/20',
            desc: isNginxOffline ? 'No Connection' : `Real Connection Rates`
          },
          {
            title: 'KUBERNETES POD STABILITY',
            value: isNginxOffline ? '0% Health' : `${clusterHealthScore}% Health`,
            icon: Layers,
            statusColor: isNginxOffline ? 'text-slate-500' : clusterHealthScore > 90 ? 'text-cyber-green' : clusterHealthScore > 70 ? 'text-cyber-yellow' : 'text-cyber-red',
            glow: isNginxOffline ? 'bg-slate-950/20 border-slate-900' : clusterHealthScore > 90 ? 'glow-green bg-cyber-green/5 border-cyber-green/20' : clusterHealthScore > 70 ? 'glow-yellow bg-cyber-yellow/5 border-cyber-yellow/30' : 'glow-red bg-cyber-red/5 border-cyber-red/35',
            desc: isNginxOffline ? 'Cluster Unreachable' : `${runningPodsCount} / ${pods.length} Pods Running`
          },
          {
            title: 'THREAT INDEX LEVEL',
            value: isNginxOffline ? 'UNKNOWN' : activeThreatLevel,
            icon: Lock,
            statusColor: isNginxOffline ? 'text-slate-500' : trafficMode === 'attack' ? 'text-cyber-red animate-pulse' : isFailureSimulated ? 'text-cyber-yellow' : 'text-cyber-green',
            glow: isNginxOffline ? 'bg-slate-950/20 border-slate-900' : trafficMode === 'attack' ? 'glow-red bg-cyber-red/5 border-cyber-red/35' : isFailureSimulated ? 'glow-yellow bg-cyber-yellow/5 border-cyber-yellow/30' : 'glow-green bg-cyber-green/5 border-cyber-green/20',
            desc: isNginxOffline ? 'Nginx Offline' : trafficMode === 'attack' ? 'SQLi / XSS Attack Vector' : 'Threat Level Low'
          }
        ].map((item, idx) => (
          <div key={idx} className={`tech-panel ${item.glow} p-4 rounded-xl flex flex-col justify-between h-28`}>
            <div className="flex justify-between items-start">
              <span className="text-[10px] font-mono text-slate-400 font-medium tracking-wider">{item.title}</span>
              <item.icon className={`h-4 w-4 ${item.statusColor}`} />
            </div>
            <div className="mt-2">
              <span className="text-xl md:text-2xl font-bold font-mono tracking-tight block">
                {item.value}
              </span>
              <span className="text-[10px] font-mono text-slate-500 block mt-1">
                {item.desc}
              </span>
            </div>
          </div>
        ))}
      </section>

      {/* MIDDLE SECTION - METRICS & LOGS (LAYER 7) */}
      <section className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* L7 traffic chart (2/3 width) */}
        <div className="xl:col-span-2 tech-panel rounded-xl p-5 flex flex-col justify-between h-[420px]">
          <div>
            <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-4">
              <div className="flex items-center gap-2">
                <Activity className="h-4 w-4 text-cyber-blue" />
                <h2 className="text-sm font-bold font-mono tracking-wider text-slate-200">
                  REAL-TIME L7 INGRESS TRAFFIC (COMPUTED FROM NGINX)
                </h2>
              </div>
              <div className="flex items-center gap-4 text-[10px] font-mono">
                <span className="flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-cyber-blue inline-block" />
                  <span className="text-slate-400">Total TPS</span>
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-cyber-red inline-block" />
                  <span className="text-slate-400">WAF Blocks</span>
                </span>
              </div>
            </div>
          </div>

          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 10, right: 5, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorRequests" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#0ea5e9" stopOpacity={0.25} />
                    <stop offset="95%" stopColor="#0ea5e9" stopOpacity={0.0} />
                  </linearGradient>
                  <linearGradient id="colorBlocks" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#ef4444" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#ef4444" stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <XAxis
                  dataKey="time"
                  stroke="#475569"
                  fontSize={10}
                  fontFamily="Share Tech Mono"
                  tickLine={false}
                />
                <YAxis
                  stroke="#475569"
                  fontSize={10}
                  fontFamily="Share Tech Mono"
                  tickLine={false}
                  axisLine={false}
                />
                <ChartTooltip
                  contentStyle={{
                    backgroundColor: 'rgba(9, 13, 22, 0.95)',
                    border: '1px solid rgba(14, 165, 233, 0.3)',
                    borderRadius: '8px',
                    fontFamily: 'Share Tech Mono',
                    fontSize: '11px',
                    color: '#f8fafc'
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="requests"
                  name="Requests (TPS)"
                  stroke="#0ea5e9"
                  strokeWidth={2}
                  fillOpacity={1}
                  fill="url(#colorRequests)"
                />
                <Area
                  type="monotone"
                  dataKey="wafBlocks"
                  name="WAF Blocks (/s)"
                  stroke="#ef4444"
                  strokeWidth={1.5}
                  fillOpacity={1}
                  fill="url(#colorBlocks)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          <div className="flex items-center justify-between border-t border-slate-800 pt-3 text-[10px] font-mono text-slate-500">
            <span>REAL TELEMETRY FEED ACTIVE</span>
            <span className="flex items-center gap-1">
              <span className={`h-1.5 w-1.5 rounded-full ${isNginxOffline ? 'bg-cyber-red animate-pulse' : 'bg-cyber-blue animate-pulse'}`} />
              {isNginxOffline ? 'INGRESS DISCONNECTED' : 'INGRESS PIPELINE SYNCED'}
            </span>
          </div>
        </div>

        {/* Access logs (1/3 width) */}
        <div className="tech-panel rounded-xl p-5 flex flex-col h-[420px] bg-slate-950/75">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-3">
            <div className="flex items-center gap-2">
              <Terminal className="h-4 w-4 text-cyber-blue" />
              <h2 className="text-sm font-bold font-mono tracking-wider text-slate-200">
                LIVE WAF ACCESS AUDIT (REAL ACCESS.LOG)
              </h2>
            </div>
            <span className="text-[10px] font-mono border border-cyber-blue/30 text-cyber-blue px-2 py-0.5 rounded uppercase bg-cyber-blue/5">
              CLICK TO TRACE
            </span>
          </div>

          {/* CLI Logs Screen */}
          <div 
            ref={logContainerRef}
            className="flex-1 overflow-y-auto font-mono text-[10px] space-y-2.5 pr-2 custom-scrollbar bg-black/40 border border-slate-900 rounded p-3 select-none"
          >
            {logs.map((log) => (
              <div 
                key={log.id} 
                onClick={() => setSelectedLogForTrace(log)}
                className="border-b border-slate-900/60 pb-1.5 leading-relaxed cursor-pointer hover:bg-cyber-blue/5 p-1 rounded transition-colors group"
                title="Click to view distributed Jaeger trace timeline"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-slate-500 group-hover:text-cyber-blue">{log.timestamp}</span>
                  <span className={`px-1 rounded text-[9px] font-bold ${
                    log.wafStatus === 'BLOCKED' ? 'bg-cyber-red/20 text-cyber-red border border-cyber-red/30' : 'bg-cyber-green/10 text-cyber-green border border-cyber-green/20'
                  }`}>
                    WAF: {log.wafStatus}
                  </span>
                </div>
                <div className="mt-1 flex flex-wrap gap-x-2 text-slate-300">
                  <span className="text-cyber-blue">{log.ip}</span>
                  <span className="text-slate-400">({log.geo})</span>
                  <span className="text-cyber-purple font-semibold">{log.method}</span>
                  <span className="text-slate-200 break-all">{log.path}</span>
                  <span className={`font-semibold ${
                    log.status >= 200 && log.status < 300
                      ? 'text-cyber-green'
                      : log.status >= 300 && log.status < 400
                      ? 'text-cyber-blue'
                      : 'text-cyber-red'
                  }`}>
                    {log.status}
                  </span>
                </div>
                {log.wafRule && (
                  <div className="mt-1 text-cyber-red/90 bg-cyber-red/5 p-1 rounded border border-cyber-red/10 flex items-start gap-1">
                    <AlertTriangle className="h-3 w-3 flex-shrink-0 mt-0.5" />
                    <span>RULE FIRED // {log.wafRule}</span>
                  </div>
                )}
                <div className="mt-1 text-[8px] text-slate-600 flex justify-between items-center opacity-0 group-hover:opacity-100 transition-opacity">
                  <span>OpenTelemetry ID: trace_{log.id}</span>
                  <span className="text-cyber-blue flex items-center gap-0.5">INSPECT TRACE <ArrowRight className="h-2 w-2" /></span>
                </div>
              </div>
            ))}
            {logs.length === 0 && !isNginxOffline && (
              <div className="text-slate-500 text-center py-10">
                Waiting for Nginx request traffic...<br/>
                <span className="text-[9px] text-slate-600">Click 'NORMAL (GET)' above to trigger test logs</span>
              </div>
            )}
            {isNginxOffline && (
              <div className="text-cyber-red text-center py-10">
                <AlertTriangle className="h-5 w-5 mx-auto mb-2" />
                <span>Nginx server unreachable. Logs disconnected.</span>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* LOWER SECTION: INFRASTRUCTURE (L3/L4) & KUBERNETES POD CLUSTER */}
      <section className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Kubernetes Cluster Monitor */}
        <div className="xl:col-span-2 tech-panel rounded-xl p-5 flex flex-col justify-between h-[360px]">
          <div>
            <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-4">
              <div className="flex items-center gap-2">
                <Layers className="h-4 w-4 text-cyber-blue" />
                <h2 className="text-sm font-bold font-mono tracking-wider text-slate-200">
                  KUBERNETES POD CLUSTER MONITOR (HEALTH: {isNginxOffline ? '0' : clusterHealthScore}%)
                </h2>
              </div>
              <div className="flex items-center gap-3 text-[10px] font-mono">
                <span className="flex items-center gap-1">
                  <span className="h-2.5 w-2.5 rounded bg-cyber-green inline-block" />
                  <span className="text-slate-400">Running</span>
                </span>
                <span className="flex items-center gap-1">
                  <span className="h-2.5 w-2.5 rounded bg-cyber-yellow inline-block" />
                  <span className="text-slate-400">Pending</span>
                </span>
                <span className="flex items-center gap-1">
                  <span className="h-2.5 w-2.5 rounded bg-cyber-red inline-block" />
                  <span className="text-slate-400">Crashed</span>
                </span>
              </div>
            </div>
          </div>

          {/* Pod Grid layout */}
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-3 mb-2">
            {pods.map(pod => {
              const displayStatus = isNginxOffline ? 'CrashLoopBackOff' : pod.status;
              const statusClass = 
                displayStatus === 'Running' 
                  ? 'bg-cyber-green/10 border-cyber-green/30 text-cyber-green' 
                  : displayStatus === 'Pending'
                  ? 'bg-cyber-yellow/10 border-cyber-yellow/30 text-cyber-yellow'
                  : 'bg-cyber-red/10 border-cyber-red/40 text-cyber-red animate-pulse';

              const indicatorColor = 
                displayStatus === 'Running' 
                  ? 'bg-cyber-green glow-green' 
                  : displayStatus === 'Pending'
                  ? 'bg-cyber-yellow glow-yellow'
                  : 'bg-cyber-red glow-red';

              return (
                <div 
                  key={pod.id} 
                  className={`border rounded-lg p-2.5 flex flex-col justify-between h-20 transition-all hover:scale-[1.03] ${statusClass}`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-[9px] text-slate-400 truncate max-w-[80%]">
                      {pod.name}
                    </span>
                    <span className={`h-1.5 w-1.5 rounded-full ${indicatorColor}`} />
                  </div>

                  <div className="mt-2 flex flex-col gap-0.5">
                    <span className="text-[10px] font-mono font-bold block uppercase tracking-tighter">
                      {displayStatus}
                    </span>
                    <span className="text-[9px] font-mono text-slate-500 block truncate">
                      R:{isNginxOffline ? pod.restarts + 1 : pod.restarts} • C:{isNginxOffline ? 0 : pod.cpu}%
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 border-t border-slate-800 pt-3 text-[10px] font-mono text-slate-500">
            <span>GRID SYSTEM STATUS: {isNginxOffline ? 'UNREACHABLE' : 'ONLINE'}</span>
            <span>NAMESPACES: default (10) | ingress (1) | kube-system (2)</span>
          </div>
        </div>

        {/* Infrastructure Row */}
        <div className="tech-panel rounded-xl p-5 flex flex-col h-[360px] justify-between">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-2">
            <div className="flex items-center gap-2">
              <Server className="h-4 w-4 text-cyber-blue" />
              <h2 className="text-sm font-bold font-mono tracking-wider text-slate-200">
                INFRASTRUCTURE (L3/L4 NODE STATE)
              </h2>
            </div>
            <div className="flex items-center gap-1.5 text-[10px] font-mono text-slate-400">
              <Wifi className={`h-3.5 w-3.5 ${isNginxOffline ? 'text-cyber-red animate-pulse' : 'text-cyber-green'}`} />
              <span>{isNginxOffline ? 'DISCONNECTED' : 'LAN SECURE'}</span>
            </div>
          </div>

          {/* 3 Servers */}
          <div className="space-y-4 flex-1 mt-2 overflow-y-auto pr-1">
            {servers.map((srv) => {
              const displayStatus = isNginxOffline ? 'crashed' : srv.status;
              const isWarning = displayStatus === 'warning';
              const isCrashed = displayStatus === 'crashed';

              return (
                <div key={srv.id} className={`border border-slate-800/80 rounded-lg p-2.5 ${
                  isCrashed ? 'bg-cyber-red/5 border-cyber-red/30' : isWarning ? 'bg-cyber-yellow/5 border-cyber-yellow/20' : 'bg-slate-900/30'
                }`}>
                  <div className="flex justify-between items-center text-[10px] font-mono mb-1.5">
                    <div className="flex items-center gap-1.5">
                      <Server className={`h-3 w-3 ${
                        isCrashed ? 'text-cyber-red animate-pulse' : isWarning ? 'text-cyber-yellow' : 'text-cyber-green'
                      }`} />
                      <span className="text-slate-300 font-semibold">{srv.name}</span>
                      <span className="text-slate-500">({srv.role})</span>
                    </div>
                    <span className={`px-1.5 rounded-sm uppercase text-[9px] ${
                      isCrashed ? 'bg-cyber-red/20 text-cyber-red font-bold' : isWarning ? 'bg-cyber-yellow/20 text-cyber-yellow font-bold' : 'bg-cyber-green/10 text-cyber-green'
                    }`}>
                      {displayStatus}
                    </span>
                  </div>

                  <div className="space-y-1.5">
                    {/* CPU */}
                    <div>
                      <div className="flex justify-between text-[9px] font-mono text-slate-400 mb-0.5">
                        <span>CPU UTILIZATION</span>
                        <span className={isCrashed ? 'text-cyber-red' : ''}>{isCrashed ? 0 : srv.cpu}%</span>
                      </div>
                      <div className="h-1.5 w-full bg-slate-950 rounded-full overflow-hidden">
                        <div
                          className={`h-full transition-all duration-500 rounded-full ${
                            isCrashed ? 'w-0' : isWarning || srv.cpu > 80 ? 'bg-cyber-yellow' : 'bg-cyber-blue'
                          }`}
                          style={{ width: `${isCrashed ? 0 : srv.cpu}%` }}
                        />
                      </div>
                    </div>

                    {/* RAM */}
                    <div>
                      <div className="flex justify-between text-[9px] font-mono text-slate-400 mb-0.5">
                        <span>RAM UTILIZATION</span>
                        <span className={isCrashed ? 'text-cyber-red' : ''}>{isCrashed ? 0 : srv.ram}%</span>
                      </div>
                      <div className="h-1.5 w-full bg-slate-950 rounded-full overflow-hidden">
                        <div
                          className={`h-full transition-all duration-500 rounded-full ${
                            isCrashed ? 'w-0' : isWarning || srv.ram > 80 ? 'bg-cyber-yellow' : 'bg-cyber-green'
                          }`}
                          style={{ width: `${isCrashed ? 0 : srv.ram}%` }}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="border-t border-slate-800 pt-2.5 flex items-center justify-between text-[9px] font-mono text-slate-400">
            <span className="flex items-center gap-1">
              <Lock className="h-3 w-3 text-cyber-blue" />
              FIREWALL RULES: 14 RULES [ACTIVE]
            </span>
            <span className="text-slate-500">PORTS INBOUND: 80, 443 SECURED</span>
          </div>
        </div>
      </section>

      {/* CI/CD DEPLOYMENT TIMELINE */}
      <section className="tech-panel rounded-xl p-5 flex flex-col min-h-[300px]">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b border-slate-800 pb-3 mb-4">
          <div className="flex items-center gap-2">
            <GitBranch className="h-4 w-4 text-cyber-blue" />
            <h2 className="text-sm font-bold font-mono tracking-wider text-slate-200">
              CI/CD AUTOMATED STAGING & DEPLOYMENT PIPELINE TIMELINE
            </h2>
          </div>
          {isRedeploying && (
            <div className="flex items-center gap-2 bg-cyber-yellow/10 border border-cyber-yellow/30 text-cyber-yellow px-3 py-1 rounded text-xs font-mono">
              <RefreshCw className="h-3.5 w-3.5 animate-spin" />
              <span>REDEPLOYING BUILD SYSTEM... {redeployProgress}%</span>
            </div>
          )}
        </div>

        <div className="relative border-l border-slate-800 ml-3 pl-6 space-y-6 py-2">
          {timeline.map((event) => {
            const isCritical = event.status === 'critical';
            const isPending = event.status === 'pending';
            const isSuccess = event.status === 'success';

            const bulletColor = 
              isCritical 
                ? 'bg-cyber-red border-cyber-red/40 glow-red' 
                : isPending 
                ? 'bg-cyber-yellow border-cyber-yellow/40 glow-yellow'
                : 'bg-cyber-green border-cyber-green/40 glow-green';

            return (
              <div key={event.id} className="relative group">
                <div className={`absolute -left-[30px] top-1 h-3.5 w-3.5 rounded-full border-4 border-slate-950 flex items-center justify-center ${bulletColor}`} />

                <div className={`tech-panel p-4 rounded-lg flex flex-col md:flex-row justify-between items-start md:items-center gap-4 ${
                  isCritical ? 'border-cyber-red/30 bg-cyber-red/5' : isPending ? 'border-cyber-yellow/30 bg-cyber-yellow/5' : ''
                }`}>
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-[10px] font-mono text-slate-400 bg-slate-900 px-2 py-0.5 rounded">
                        {event.timestamp}
                      </span>
                      <span className={`text-xs font-bold font-mono ${
                        isCritical ? 'text-cyber-red' : isPending ? 'text-cyber-yellow animate-pulse' : 'text-cyber-green'
                      }`}>
                        {event.type.toUpperCase()}
                      </span>
                      {event.commitHash && (
                        <span className="text-[10px] font-mono text-cyber-blue bg-cyber-blue/5 border border-cyber-blue/20 px-1.5 py-0.2 rounded">
                          commit:{event.commitHash}
                        </span>
                      )}
                    </div>
                    <h3 className="text-sm font-semibold text-slate-200 mt-1 font-sans">
                      {event.title}
                    </h3>
                    <p className="text-xs text-slate-400 font-mono">
                      {event.subtitle}
                    </p>
                  </div>

                  {event.actionRequired && (
                    <button
                      onClick={handleRedeploy}
                      disabled={isRedeploying || isNginxOffline}
                      className={`w-full md:w-auto flex items-center justify-center gap-1.5 bg-cyber-red text-white font-mono font-bold text-xs uppercase px-4 py-2.5 rounded shadow-lg border transition-all ${
                        isNginxOffline 
                        ? 'border-transparent bg-slate-950 text-slate-600 cursor-not-allowed' 
                        : 'hover:bg-cyber-red/90 border-cyber-red active:scale-95 shadow-cyber-red/20'
                      }`}
                    >
                      <RefreshCw className={`h-3.5 w-3.5 ${isRedeploying ? 'animate-spin' : ''}`} />
                      REDEPLOY ROLLBACK
                    </button>
                  )}
                  
                  {isSuccess && !event.actionRequired && (
                    <div className="flex items-center gap-1.5 text-cyber-green font-mono text-[10px] border border-cyber-green/30 bg-cyber-green/5 px-2.5 py-1 rounded">
                      <Check className="h-3.5 w-3.5" />
                      <span>STABLE RUNNING</span>
                    </div>
                  )}

                  {isPending && (
                    <div className="flex items-center gap-1.5 text-cyber-yellow font-mono text-[10px] border border-cyber-yellow/30 bg-cyber-yellow/5 px-2.5 py-1 rounded">
                      <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                      <span>ROLLING ROLLOUT</span>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* OPENTELEMETRY / JAEGER DISTRIBUTED TRACE MODAL */}
      {selectedLogForTrace && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in">
          <div className="relative w-full max-w-4xl bg-slate-950 border border-cyber-blue/30 rounded-xl shadow-2xl p-6 overflow-hidden flex flex-col max-h-[90vh]">
            <div className="scanline" />
            
            {/* Modal Header */}
            <div className="flex justify-between items-start border-b border-slate-800 pb-4 mb-4">
              <div>
                <div className="flex items-center gap-2 text-xs font-mono text-cyber-blue mb-1">
                  <Clock className="h-3.5 w-3.5" />
                  <span>OPENTELEMETRY TRACE RECONSTRUCTION // Trace ID: otel_trace_{selectedLogForTrace.id}</span>
                </div>
                <h3 className="text-lg font-bold font-mono tracking-tight text-slate-100 flex items-center gap-2">
                  <span className={`px-1.5 py-0.5 rounded text-xs font-bold uppercase ${
                    selectedLogForTrace.method === 'GET' ? 'bg-cyber-blue/20 text-cyber-blue' : 'bg-cyber-purple/20 text-cyber-purple'
                  }`}>
                    {selectedLogForTrace.method}
                  </span>
                  <span>{selectedLogForTrace.path}</span>
                  <span className={`text-sm px-1.5 py-0.2 rounded font-bold ${
                    selectedLogForTrace.status >= 200 && selectedLogForTrace.status < 300
                      ? 'bg-cyber-green/25 text-cyber-green'
                      : 'bg-cyber-red/25 text-cyber-red'
                  }`}>
                    {selectedLogForTrace.status}
                  </span>
                </h3>
              </div>
              <button 
                onClick={() => setSelectedLogForTrace(null)}
                className="p-1 hover:bg-slate-900 border border-transparent hover:border-slate-800 rounded-lg text-slate-400 hover:text-slate-100 transition-all"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Request Summary */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 bg-slate-900/40 border border-slate-900 rounded-lg p-3 text-xs font-mono text-slate-400 mb-6">
              <div>
                <span className="text-slate-500 block text-[9px]">CLIENT ADDRESS</span>
                <span className="text-cyber-blue font-semibold">{selectedLogForTrace.ip}</span>
              </div>
              <div>
                <span className="text-slate-500 block text-[9px]">GEOLOCATION</span>
                <span className="text-slate-200">{selectedLogForTrace.geo}</span>
              </div>
              <div>
                <span className="text-slate-500 block text-[9px]">ROUTE NODE</span>
                <span className="text-slate-200">{servedByNode}</span>
              </div>
              <div className="truncate" title={selectedLogForTrace.userAgent}>
                <span className="text-slate-500 block text-[9px]">CLIENT AGENT</span>
                <span className="text-slate-200">{selectedLogForTrace.userAgent || 'Mozilla/5.0'}</span>
              </div>
            </div>

            {/* Gantt Chart Spans (Distributed Tracing visualization) */}
            <div className="flex-1 overflow-y-auto space-y-5 pr-2 custom-scrollbar">
              <div className="border border-slate-900 bg-slate-900/10 rounded-lg p-4">
                <div className="flex justify-between items-center text-[10px] font-mono text-slate-500 border-b border-slate-900 pb-2 mb-4">
                  <span>SPAN TIMELINE (SERVICE BREAKDOWN)</span>
                  <span>TOTAL REQUEST LATENCY</span>
                </div>

                <div className="space-y-4">
                  {generateSpansForLog(selectedLogForTrace).map((span, idx) => {
                    // Calculate visual bar percentage width and start offsets
                    // Max trace width represents ~25ms total scaling
                    const maxScalingDuration = 30; 
                    const barWidth = Math.min(100, (span.durationMs / maxScalingDuration) * 100);
                    const barOffset = Math.min(95, (span.startOffsetMs / maxScalingDuration) * 100);
                    
                    const isError = span.status === 'error';
                    
                    const barBg = isError 
                      ? 'bg-gradient-to-r from-cyber-red/80 to-cyber-red glow-red' 
                      : span.service === 'client-ingress-router'
                      ? 'bg-gradient-to-r from-cyber-blue/80 to-cyber-blue glow-blue'
                      : span.service === 'nginx-load-balancer'
                      ? 'bg-gradient-to-r from-cyber-purple/80 to-cyber-purple'
                      : span.service === 'app-backend-node'
                      ? 'bg-gradient-to-r from-cyber-yellow/80 to-cyber-yellow glow-yellow'
                      : 'bg-gradient-to-r from-cyber-green/80 to-cyber-green glow-green';

                    const ServiceIcon = 
                      span.service.includes('database') ? Database :
                      span.service.includes('nginx') ? Server :
                      span.service.includes('app') ? Cpu :
                      Activity;

                    return (
                      <div key={idx} className="space-y-1.5">
                        <div className="flex justify-between items-center text-xs font-mono">
                          <span className="flex items-center gap-1.5 font-bold text-slate-300">
                            <ServiceIcon className={`h-3.5 w-3.5 ${isError ? 'text-cyber-red' : 'text-cyber-green'}`} />
                            <span className="text-[10px] text-slate-500 font-medium">[{span.service}]</span>
                            <span>{span.name}</span>
                          </span>
                          <span className={`font-semibold ${isError ? 'text-cyber-red' : 'text-cyber-green'}`}>
                            {span.durationMs} ms
                          </span>
                        </div>
                        
                        {/* Gantt Bar */}
                        <div className="relative h-4 bg-slate-950/70 border border-slate-900 rounded-sm overflow-hidden flex items-center">
                          <div 
                            className={`h-full rounded-sm transition-all duration-700 ${barBg}`}
                            style={{ 
                              width: `${barWidth}%`, 
                              marginLeft: `${barOffset}%` 
                            }}
                          />
                        </div>

                        {/* Span Info Details */}
                        <div className="text-[10px] font-mono text-slate-500 pl-3 leading-relaxed">
                          DETAILS // {span.info}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="border-t border-slate-900 pt-4 mt-4 flex justify-between items-center text-[10px] font-mono text-slate-500">
              <span className="flex items-center gap-1">
                <Globe className="h-3.5 w-3.5 text-cyber-blue" />
                SPAN ROOT: client-ingress-router
              </span>
              <span>TRACING ENGINE: Grafana Tempo // OpenTelemetry v1.2.0</span>
            </div>
          </div>
        </div>
      )}

      {/* FOOTER */}
      <footer className="text-center py-4 border-t border-slate-900 mt-4 text-[10px] font-mono text-slate-500 flex flex-col md:flex-row justify-between items-center gap-2">
        <span>SECURITY NOC OVERVIEW CONSOLE v2.5.0</span>
        <span>© 2026 CENTRAL DEV-SEC-OPS GLOBAL ENTERPRISE INC</span>
        <span className="flex items-center gap-1 text-cyber-green">
          <Globe className="h-3 w-3 text-cyber-blue" />
          GEO-ROUTE: INGRESS LEVEL CLOUD-FLARE POOL
        </span>
      </footer>
    </div>
  );
}
