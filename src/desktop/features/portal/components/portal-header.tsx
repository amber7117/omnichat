export function PortalHeader() {
  return (
    <div style={{ marginBottom: '20px' }}>
      <h1>@cardos/service-bus-portal 控制台</h1>
      <p>
        我们现在正式通过 <code>@cardos/service-bus-portal</code> 连接 Worker / Iframe 与主线程能力，
        此页面加载的是真实 CDN 版本（<code>https://esm.sh/@cardos/service-bus-portal@1.0.2</code>）。
      </p>
      <p>
        <strong>🏗️ 架构：</strong> 主线程提供服务能力，隔离上下文（Worker / Iframe）通过 Portal 调用，
        形成安全、可观测的多端通信通道。
      </p>
    </div>
  );
} 