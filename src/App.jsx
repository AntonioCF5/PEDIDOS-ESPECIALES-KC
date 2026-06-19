import { useState } from "react";
import OrderForm from "./components/OrderForm";

/**
 * Router mínimo sin dependencias: el widget es esencialmente una sola
 * pantalla (el formulario de pedido) más una pantalla de confirmación tras
 * crear la orden en WooCommerce.
 */
export default function App() {
  const [completed, setCompleted] = useState(null);

  if (completed) {
    return (
      <div className="app">
        <header className="topbar">
          <h1>Pedidos Especiales — Krea Canvas</h1>
        </header>
        <main className="content">
          <div className="success-screen">
            <div className="success-check" aria-hidden>✓</div>
            <h2>Pedido creado</h2>
            <p>
              Orden en WooCommerce:{" "}
              <strong>#{completed.order_number || completed.order_id}</strong>
            </p>
            {completed.deal_id && (
              <p className="success-meta">
                Deal en Zoho CRM:{" "}
                <strong>{completed.deal_id}</strong>
              </p>
            )}
            <button
              type="button"
              className="btn-primary btn-lg"
              onClick={() => setCompleted(null)}
            >
              Crear otro pedido
            </button>
          </div>
        </main>
      </div>
    );
  }

  return <OrderForm onCompleted={setCompleted} />;
}
