/**
 * constants.js — única fuente de verdad para api_names de Zoho, picklists y config.
 *
 * Ningún componente debe escribir un api_name literal: si un campo cambia de
 * nombre en Zoho, se corrige solo aquí.
 *
 * Los api_names de MODULES / PRODUCT_FIELDS / MATERIAL_FIELDS / CONTACT_FIELDS
 * fueron tomados del org de Zoho CRM KC. El módulo de Sets (FR-15) aún NO
 * existe; su api_name es un placeholder a confirmar tras crear el módulo.
 */

/* --------------------------------------------------------------------------
 * Módulos
 * ------------------------------------------------------------------------ */
export const MODULES = {
  CONTACTS: "Contacts",
  PRODUCTS: "Products",
  MATERIALES: "Materiales_Producci_n",
  // TODO(FR-15 / D-6): crear el módulo de Sets en Zoho CRM KC y confirmar el api_name.
  SETS: "Sets",
};

/* --------------------------------------------------------------------------
 * Campos del módulo Products (catálogo de Krea Canvas)
 * ------------------------------------------------------------------------ */
export const PRODUCT_FIELDS = {
  ID: "id",
  NAME: "Product_Name",
  CODE: "Product_Code",
  UNIT_PRICE: "Unit_Price",
  ACTIVE: "Product_Active",
  BASE: "Base",
  ALTURA: "Altura",
  METRICA: "Metrica",
  MATERIAL: "Material",
  METROS_CUADRADOS: "Metros_Cuadrados",
  WOOCOMMERCE_ID: "Woocommerce_ID",
  TIENDA: "Tienda",
};

/* --------------------------------------------------------------------------
 * Campos del módulo Materiales_Producci_n
 * ------------------------------------------------------------------------ */
export const MATERIAL_FIELDS = {
  ID: "id",
  NAME: "Name",
  ALIAS: "Alias",
  COSTO_M2: "Costo_por_m2",
  ACTIVO: "Activo",
};

/* --------------------------------------------------------------------------
 * Campos del módulo de Sets (a crear — FR-15)
 * ------------------------------------------------------------------------ */
export const SET_FIELDS = {
  ID: "id",
  NAME: "Name",
  BASE: "Base",
  ALTURA: "Altura",
  TIPO_MEDIDA: "Tipo_de_medida",
};

/* --------------------------------------------------------------------------
 * Campos del módulo Contacts
 * ------------------------------------------------------------------------ */
export const CONTACT_FIELDS = {
  ID: "id",
  FIRST_NAME: "First_Name",
  LAST_NAME: "Last_Name",
  FULL_NAME: "Full_Name",
  EMAIL: "Email",
  PHONE: "Phone",
  MOBILE: "Mobile",
};

/* --------------------------------------------------------------------------
 * Tipo de medida (picklist "Metrica" en Products)
 * ------------------------------------------------------------------------ */
export const TIPO_MEDIDA = {
  CM: "cm",
  PULGADAS: "pulgadas",
};
export const TIPO_MEDIDA_OPTIONS = [TIPO_MEDIDA.CM, TIPO_MEDIDA.PULGADAS];

/* --------------------------------------------------------------------------
 * Tipo de línea del pedido
 * ------------------------------------------------------------------------ */
export const ROW_TYPES = {
  CATALOGO: "catalogo",
  PERSONALIZADO: "personalizado",
};

/* --------------------------------------------------------------------------
 * Métodos de pago + desglose del cobro
 *
 * METODO_PAGO_BREAKDOWN declara, por método, qué campos pide el desglose:
 *   - type "amount": monto numérico. El ÚLTIMO "amount" de la lista se
 *     auto-calcula en vivo como Gran Total - suma(otros montos).
 *   - type "text": referencia / número de aprobación. `required: true` bloquea.
 *
 * NOTA: confirmar contra el desglose real del widget de Krea Studio.
 * ------------------------------------------------------------------------ */
export const METODO_PAGO_VALUES = {
  EFECTIVO: "Efectivo",
  TRANSFERENCIA: "Transferencia",
  TARJETA_DEBITO: "Tarjeta de débito",
  TARJETA_CREDITO: "Tarjeta de crédito",
  MIXTO: "Pago mixto",
};

export const METODO_PAGO_OPTIONS = Object.values(METODO_PAGO_VALUES);

export const METODO_PAGO_BREAKDOWN = {
  [METODO_PAGO_VALUES.EFECTIVO]: [
    { key: "monto_efectivo", label: "Monto en efectivo", type: "amount" },
  ],
  [METODO_PAGO_VALUES.TRANSFERENCIA]: [
    {
      key: "referencia_transferencia",
      label: "Referencia de transferencia",
      type: "text",
      required: true,
    },
    { key: "monto_transferencia", label: "Monto transferido", type: "amount" },
  ],
  [METODO_PAGO_VALUES.TARJETA_DEBITO]: [
    {
      key: "aprobacion_debito",
      label: "Número de aprobación",
      type: "text",
      required: true,
    },
    { key: "monto_debito", label: "Monto con tarjeta de débito", type: "amount" },
  ],
  [METODO_PAGO_VALUES.TARJETA_CREDITO]: [
    {
      key: "aprobacion_credito",
      label: "Número de aprobación",
      type: "text",
      required: true,
    },
    { key: "monto_credito", label: "Monto con tarjeta de crédito", type: "amount" },
  ],
  [METODO_PAGO_VALUES.MIXTO]: [
    { key: "monto_efectivo", label: "Monto en efectivo", type: "amount" },
    {
      key: "referencia_transferencia",
      label: "Referencia de transferencia",
      type: "text",
      required: false,
    },
    { key: "monto_transferencia", label: "Monto transferido", type: "amount" },
  ],
};

/* --------------------------------------------------------------------------
 * Dirección de entrega — declarativo (se renderiza y valida en bucle)
 * ------------------------------------------------------------------------ */
export const ESTADOS_MEXICO = [
  "Aguascalientes",
  "Baja California",
  "Baja California Sur",
  "Campeche",
  "Chiapas",
  "Chihuahua",
  "Ciudad de México",
  "Coahuila",
  "Colima",
  "Durango",
  "Estado de México",
  "Guanajuato",
  "Guerrero",
  "Hidalgo",
  "Jalisco",
  "Michoacán",
  "Morelos",
  "Nayarit",
  "Nuevo León",
  "Oaxaca",
  "Puebla",
  "Querétaro",
  "Quintana Roo",
  "San Luis Potosí",
  "Sinaloa",
  "Sonora",
  "Tabasco",
  "Tamaulipas",
  "Tlaxcala",
  "Veracruz",
  "Yucatán",
  "Zacatecas",
];

export const SHIPPING_FIELDS = [
  { key: "CALLE_Y_NUMERO", label: "Calle y número", required: true, type: "text" },
  { key: "COLONIA", label: "Colonia", required: true, type: "text" },
  { key: "CODIGO_POSTAL", label: "Código postal", required: true, type: "text" },
  { key: "CIUDAD", label: "Ciudad", required: true, type: "text" },
  {
    key: "ESTADO",
    label: "Estado",
    required: true,
    type: "select",
    options: ESTADOS_MEXICO,
  },
  {
    key: "NOTAS_ENTREGA",
    label: "Notas extra de entrega",
    required: false,
    type: "textarea",
  },
];

/* --------------------------------------------------------------------------
 * Integración con WooCommerce de Krea Canvas
 * ------------------------------------------------------------------------ */
export const WOOCOMMERCE = {
  // Zoho Function (Deluge) que crea la orden en el WooCommerce de Krea Canvas.
  // TODO: crear esta función en Zoho CRM KC (ver docs/WOOCOMMERCE_FUNCTION.md)
  // junto con su Connection y Variable CRM; confirmar el api_name final.
  FUNCTION_NAME: "krea_create_woocommerce_order_kc",

  // WooCommerce KC está configurado con prices_include_tax = true.
  // Los precios capturados en el widget incluyen IVA; el builder los divide
  // entre (1 + TAX_RATE) antes de enviarlos.
  TAX_RATE: 0.16,

  // Prefijo de los productos personalizados creados en WooCommerce.
  // Debe coincidir EXACTAMENTE con el prefijo que la integración del
  // Componente 2 excluye de la sincronización (FR-14 / SC-4).
  CUSTOM_PRODUCT_PREFIX: "Pedido Especial",

  // Estado inicial de la orden creada en WooCommerce.
  ORDER_STATUS: "processing",

  // Valor del picklist "Tienda" en Products que identifica el catálogo de KC.
  TIENDA_KC: "Krea Canvas",
};

/* --------------------------------------------------------------------------
 * Límites de UI
 * ------------------------------------------------------------------------ */
export const UI = {
  PICKER_MAX_RESULTS: 50,
};
