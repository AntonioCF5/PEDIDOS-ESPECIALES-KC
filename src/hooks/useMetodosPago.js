import { METODO_PAGO_OPTIONS } from "../utils/constants";

/**
 * Opciones de método de pago.
 *
 * En el widget de Krea Studio esto se leía del picklist `Metodo_de_pago` del
 * Deal. El widget de Pedidos Especiales no escribe a un Deal, así que la lista
 * es estática (definida en constants.js). El hook se mantiene para conservar
 * la misma interfaz que el resto de hooks de carga de datos.
 */
export default function useMetodosPago() {
  return { metodos: METODO_PAGO_OPTIONS, loading: false, error: null };
}
