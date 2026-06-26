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
  // El widget crea un Deal antes de generar la orden WooCommerce. La función
  // krea_create_woocommerce_order_kc actualiza ese Deal con Numero_de_orden y
  // Woocommerce_Order_ID al terminar.
  DEALS: "Deals",
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
 * Campos del módulo Deals (el widget crea un Deal antes de la orden WC).
 *
 * ⚠️ Si Zoho rechaza el insertRecord con INVALID_DATA, lo más probable es
 * que uno de estos api_names no exista en el layout del módulo Deals de
 * Krea Canvas. Ajustar aquí — ningún otro archivo escribe api_names literales.
 * Campos de WC (Numero_de_orden, Woocommerce_Order_ID) los rellena la Zoho
 * Function al crear la orden, NO el widget.
 * ------------------------------------------------------------------------ */
export const DEAL_FIELDS = {
  ID: "id",
  DEAL_NAME: "Deal_Name",
  STAGE: "Stage",
  CONTACT_NAME: "Contact_Name",
  TIENDA: "Tienda",
  // Picklist en Zoho — los valores deben coincidir EXACTOS con TIPO_PEDIDO_VALUES
  // ("Reposición", "Muestra", "Pedido Especial"). Si Zoho rechaza, revisar acentos.
  TIPO_PEDIDO: "Tipo_de_Pedido",
  // Solo se llena cuando tipoPedido === "Reposición".
  MOTIVO_REPOSICION: "Motivo_de_reposicion",
  // Número de la orden original que se está reponiendo. Solo se llena cuando
  // tipoPedido === "Reposición". OJO: NO confundir con NUMERO_ORDEN — ese es
  // el número WC de la NUEVA orden que crea este pedido.
  ORDEN_A_REPONER: "Orden_a_Reponer",
  // Campos solicitados como `null` en el payload inicial (los completa el
  // operador o algún otro proceso después).
  TOTAL_GUIAS: "Total_Guias",
  CIUDAD_SESION: "Ciudad_Sesi_n",
  // Pago y totales (numéricos planos — sin "$" ni comas).
  TOTAL_CUADRO: "Total_Cuadro",
  DESCUENTO: "Descuento",
  GRAN_TOTAL: "Gran_Total",
  METODO_PAGO: "Metodo_de_pago",
  // Datetime ISO 8601 con offset MX. Si en KC resulta ser campo de solo Fecha,
  // el formatter zohoDateOnly() devuelve yyyy-MM-dd.
  FECHA_Y_HORA: "Fecha_y_Hora",
  // Dirección de envío — espejo de billing/shipping de WC.
  CALLE_Y_NUMERO: "Calle_y_Numero",
  COLONIA: "Colonia",
  CIUDAD: "Ciudad",
  CODIGO_POSTAL: "Codigo_Postal",
  ESTADO: "Estado",
  NOTAS_ENTREGA: "Notas_Extra_de_Entrega",
  // Los rellena la Zoho Function krea_create_woocommerce_order al terminar.
  NUMERO_ORDEN: "Numero_de_orden",
  WOOCOMMERCE_ORDER_ID: "Woocommerce_Order_ID",
  // Subform: un renglón por cada cuadro del pedido. Ver SUBFORM_FIELDS.
  CUADROS_ORDEN: "Cuadros_Orden",
};

/* --------------------------------------------------------------------------
 * Columnas del subform `Cuadros_Orden` del Deal. Un renglón por cuadro /
 * line item. `Product` es lookup al módulo Products (MODULES.PRODUCTS):
 * en filas de catálogo se enlaza al id real del producto Zoho; en filas
 * personalizadas queda null porque el cuadro nace solo en WooCommerce.
 * `Material` es lookup a Materiales_Producci_n (MODULES.MATERIALES).
 * ------------------------------------------------------------------------ */
export const SUBFORM_FIELDS = {
  ES_PERSONALIZADO: "Es_Personalizado",
  PRODUCT: "Product",
  MATERIAL: "Material",
  BASE_CM: "Base_cm",
  ALTURA_CM: "Altura_cm",
  CANTIDAD: "Cantidad",
  PRECIO_UNITARIO: "Precio_Unitario",
  // Subtotal NO se manda — es campo Formula en Zoho, se calcula solo.
  NOTAS: "Notas",
};

/* --------------------------------------------------------------------------
 * Valores del picklist Stage en Deals (solo los que usa el widget).
 * "En Produccion" sin acento — debe coincidir EXACTO con el picklist en
 * Zoho CRM KC; si Zoho rechaza con INVALID_DATA aquí, agregar el acento.
 * ------------------------------------------------------------------------ */
export const STAGE_VALUES = {
  INICIAL: "En Produccion",
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
 * Clase de pedido (paso 1 del widget). Es metadato puro: no cambia el flujo
 * de captura (precios, dirección, pago siguen iguales) ni el prefijo de
 * productos personalizados en WooCommerce (CUSTOM_PRODUCT_PREFIX se mantiene
 * "Pedido Especial" porque el Componente 2 lo usa para excluir de sync).
 * Se incluye en meta_data y customer_note de la orden WC para que producción
 * y administración sepan qué tipo de pedido es.
 * ------------------------------------------------------------------------ */
export const TIPO_PEDIDO_VALUES = {
  REPOSICION: "Reposición",
  MUESTRA: "Muestra",
  PEDIDO_ESPECIAL: "Pedido Especial",
};

export const TIPO_PEDIDO_OPTIONS = [
  TIPO_PEDIDO_VALUES.REPOSICION,
  TIPO_PEDIDO_VALUES.MUESTRA,
  TIPO_PEDIDO_VALUES.PEDIDO_ESPECIAL,
];

/**
 * Prefijos de productos custom creados por el widget en WooCommerce.
 * Los nombres reales son `${tipoPedido} | <cant> <material> <medidas>` —
 * uno por cada tipo de pedido. Esta lista la usa `useProducts` para
 * excluirlos del catálogo (no debe aparecer un "Pedido Especial | ..."
 * de una orden anterior como producto seleccionable en otra).
 *
 * Si la integración del Componente 2 también filtra por este prefijo para
 * excluirlos del sync, debe usar esta misma lista — no solo "Pedido Especial".
 */
export const CUSTOM_PRODUCT_PREFIXES = [
  TIPO_PEDIDO_VALUES.PEDIDO_ESPECIAL,
  TIPO_PEDIDO_VALUES.REPOSICION,
  TIPO_PEDIDO_VALUES.MUESTRA,
];

/* --------------------------------------------------------------------------
 * Tienda (paso 1 del widget). KC y KS son las dos tiendas del grupo Krea.
 * El valor que se persiste en Zoho (Deal.Tienda y meta_data de WC) es el
 * NOMBRE COMPLETO ("Krea Canvas" / "Krea Studio") porque es lo que ya
 * existe como picklist en el módulo Deals. La abreviatura es solo para UI.
 * ------------------------------------------------------------------------ */
export const TIENDA_VALUES = {
  KC: "Krea Canvas",
  KS: "Krea Studio",
};

export const TIENDA_OPTIONS = [TIENDA_VALUES.KC, TIENDA_VALUES.KS];

/** Abreviaturas para mostrar de forma compacta en la UI. */
export const TIENDA_ABBREV = {
  [TIENDA_VALUES.KC]: "KC",
  [TIENDA_VALUES.KS]: "KS",
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

/**
 * Mapeo de cada método del widget al `payment_method` (slug/ID) que WooCommerce
 * espera en su API de órdenes. WC no requiere que el slug corresponda a un
 * gateway instalado — si no hay gateway con ese ID, simplemente lo guarda
 * como string y muestra `payment_method_title` en la UI.
 */
export const METODO_PAGO_WC_SLUG = {
  [METODO_PAGO_VALUES.EFECTIVO]: "efectivo",
  [METODO_PAGO_VALUES.TRANSFERENCIA]: "transferencia",
  [METODO_PAGO_VALUES.TARJETA_DEBITO]: "tarjeta_debito",
  [METODO_PAGO_VALUES.TARJETA_CREDITO]: "tarjeta_credito",
  [METODO_PAGO_VALUES.MIXTO]: "pago_mixto",
};

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

/**
 * Mapeo nombre de estado → código WooCommerce (ISO 3166-2:MX).
 * WooCommerce REST API rechaza el bloque `billing`/`shipping` con
 * `rest_invalid_param` cuando `state` llega como nombre completo
 * ("Coahuila") en lugar del código corto ("COA"). El widget guarda el
 * nombre completo en el Deal/UI; al construir el payload WC convertimos
 * a código vía este mapa.
 */
export const ESTADO_WC_CODE = {
  "Aguascalientes": "AGS",
  "Baja California": "BCN",
  "Baja California Sur": "BCS",
  "Campeche": "CAM",
  "Chiapas": "CHP",
  "Chihuahua": "CHH",
  "Ciudad de México": "DIF",
  "Coahuila": "COA",
  "Colima": "COL",
  "Durango": "DUR",
  "Estado de México": "MEX",
  "Guanajuato": "GUA",
  "Guerrero": "GRO",
  "Hidalgo": "HID",
  "Jalisco": "JAL",
  "Michoacán": "MIC",
  "Morelos": "MOR",
  "Nayarit": "NAY",
  "Nuevo León": "NLE",
  "Oaxaca": "OAX",
  "Puebla": "PUE",
  "Querétaro": "QUE",
  "Quintana Roo": "ROO",
  "San Luis Potosí": "SLP",
  "Sinaloa": "SIN",
  "Sonora": "SON",
  "Tabasco": "TAB",
  "Tamaulipas": "TAM",
  "Tlaxcala": "TLA",
  "Veracruz": "VER",
  "Yucatán": "YUC",
  "Zacatecas": "ZAC",
};

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
  // Zoho Function (Deluge) que crea la orden en WooCommerce. Recibe solo
  // metadatos: { order_type, store, contact_id, deal_id }. La función se
  // encarga de leer el Deal, crear productos custom si aplica, y crear la
  // orden en WC. Atiende tanto KC como KS — sin sufijo _kc.
  FUNCTION_NAME: "krea_create_woocommerce_order",

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
