import { describe, expect, it } from 'vitest'
import {
  avisoSobrepago,
  documentoDePago,
  estadosPorDocumento,
  mensajeBorradoDocumento,
  mensajePagoCreacion,
  montoSugerido,
  pagoAlContado,
  puedeAgregarPago,
  saldoDe,
  textoEstadoPago,
  totalPagosVigentes,
  validarPago,
} from './pagos'

describe('validarPago', () => {
  it('acepta monto en formato chileno y fecha', () => {
    const r = validarPago({ monto: '1.234,5', fecha: '2026-10-07' })
    expect(r.valido).toBe(true)
    expect(r.datos).toEqual({ monto: 1234.5, fecha_pago: '2026-10-07' })
    expect(r.errores).toEqual({})
  })

  it('monto vacío, cero, no numérico: error de monto', () => {
    for (const monto of ['', '   ', '0', '0,0', 'abc', null, undefined]) {
      const r = validarPago({ monto, fecha: '2026-10-07' })
      expect(r.valido).toBe(false)
      expect(r.errores.monto).toBeTruthy()
    }
  })

  it('fecha obligatoria y con formato ISO', () => {
    for (const fecha of ['', null, undefined, '07-10-2026']) {
      const r = validarPago({ monto: '100', fecha })
      expect(r.valido).toBe(false)
      expect(r.errores.fecha).toBeTruthy()
      expect(r.errores.monto).toBeUndefined()
    }
  })
})

describe('saldoDe', () => {
  it('sin pagos: pendiente con todo el saldo', () => {
    expect(saldoDe(1000, [])).toEqual({ total: 1000, pagado: 0, saldo: 1000, estado: 'pendiente', sobrepago: false })
  })

  it('pago parcial: parcial', () => {
    const r = saldoDe(1000, [{ monto: '400' }, { monto: 100 }])
    expect(r).toMatchObject({ pagado: 500, saldo: 500, estado: 'parcial', sobrepago: false })
  })

  it('pagado exacto: pagado, saldo 0', () => {
    expect(saldoDe(1000, [{ monto: 1000 }])).toMatchObject({ saldo: 0, estado: 'pagado', sobrepago: false })
  })

  it('sobrepago: pagado con saldo negativo (igual que la vista)', () => {
    expect(saldoDe(1000, [{ monto: 1200 }])).toMatchObject({ saldo: -200, estado: 'pagado', sobrepago: true })
  })

  it('total 0 sin pagos: pagado (nada adeudado), como la vista', () => {
    expect(saldoDe(0, [])).toMatchObject({ estado: 'pagado', saldo: 0 })
  })

  it('valores de la base como texto y pagos vacíos', () => {
    expect(saldoDe('1000.00', null)).toMatchObject({ pagado: 0, estado: 'pendiente' })
  })
})

describe('avisoSobrepago', () => {
  it('sin exceso: null', () => {
    expect(avisoSobrepago(1000, 400, 600)).toBeNull()
    expect(avisoSobrepago(1000, 0, 1)).toBeNull()
  })

  it('con exceso: texto con el total, lo pagado y el exceso', () => {
    const texto = avisoSobrepago(1000, 400, 700)
    expect(texto).toContain('$1.000')
    expect(texto).toContain('$1.100')
    expect(texto).toContain('$100')
  })

  it('ya estaba sobrepagado: sigue avisando', () => {
    expect(avisoSobrepago(1000, 1200, 10)).not.toBeNull()
  })
})

describe('montoSugerido', () => {
  it('es el saldo pendiente si es positivo', () => {
    expect(montoSugerido(1000, 400)).toBe(600)
  })

  it('sin saldo o sobrepagado: null', () => {
    expect(montoSugerido(1000, 1000)).toBeNull()
    expect(montoSugerido(1000, 1500)).toBeNull()
  })
})

describe('puedeAgregarPago', () => {
  it('no en documentos anulados', () => {
    expect(puedeAgregarPago({ estado_documento: 'anulado' })).toBe(false)
    expect(puedeAgregarPago({ estado_documento: 'vigente' })).toBe(true)
    expect(puedeAgregarPago({})).toBe(true)
  })
})

describe('estadosPorDocumento / textoEstadoPago', () => {
  it('indexa las filas de la vista por id_documento', () => {
    const mapa = estadosPorDocumento([
      { id_documento: 'a', estado_pago: 'pagado', saldo: 0 },
      { id_documento: 'b', estado_pago: 'parcial', saldo: 5 },
    ])
    expect(mapa.get('b').estado_pago).toBe('parcial')
    expect(mapa.size).toBe(2)
    expect(estadosPorDocumento(null).size).toBe(0)
  })

  it('texto legible; el sobrepago se distingue', () => {
    expect(textoEstadoPago({ estado_pago: 'pagado', saldo: 0 })).toBe('Pagado')
    expect(textoEstadoPago({ estado_pago: 'pagado', saldo: -3 })).toBe('Pagado (sobrepago)')
    expect(textoEstadoPago({ estado_pago: 'pendiente' })).toBe('Pendiente')
    expect(textoEstadoPago({ estado_pago: 'parcial' })).toBe('Parcial')
    expect(textoEstadoPago({ estado_pago: 'anulado' })).toBe('Anulado')
    expect(textoEstadoPago(undefined)).toBe('')
  })
})

describe('documentoDePago / totalPagosVigentes', () => {
  const pagoFactura = {
    monto: 100,
    factura: { numero_factura: '55', estado_documento: 'vigente', proveedor: { nombre: 'Papelera' } },
    boleta: null,
  }
  const pagoBoleta = { monto: 50, factura: null, boleta: { lineas: [{ descripcion: 'Arriendo', created_at: '2026-10-01' }], estado_documento: 'anulado' } }

  it('describe el documento del pago', () => {
    expect(documentoDePago(pagoFactura)).toEqual({ tipo: 'factura', texto: 'Factura N° 55 — Papelera', anulado: false })
    expect(documentoDePago(pagoBoleta)).toEqual({ tipo: 'boleta', texto: 'Boleta — Arriendo', anulado: true })
  })

  it('el nombre de la boleta sale de sus líneas; sin líneas, "Boleta sin líneas"', () => {
    const dos = { boleta: { lineas: [{ descripcion: 'Luz', created_at: '2026-10-01' }, { descripcion: 'Agua', created_at: '2026-10-02' }] } }
    expect(documentoDePago(dos).texto).toBe('Boleta — Luz (+1 más)')
    expect(documentoDePago({ boleta: { lineas: [] } }).texto).toBe('Boleta sin líneas')
    expect(documentoDePago({ boleta: null }).texto).toBe('Boleta sin líneas')
  })

  it('el total no suma pagos de documentos anulados', () => {
    expect(totalPagosVigentes([pagoFactura, pagoBoleta])).toBe(100)
    expect(totalPagosVigentes([])).toBe(0)
  })
})

describe('mensajeBorradoDocumento', () => {
  it('23503 (FK de pagos): mensaje accionable', () => {
    const texto = mensajeBorradoDocumento({ code: '23503' })
    expect(texto).toContain('Tiene pagos registrados')
    expect(texto).toContain('Cuotas/Pagos')
  })

  it('otros errores: null (se usa el mensaje general)', () => {
    expect(mensajeBorradoDocumento({ code: '42501' })).toBeNull()
    expect(mensajeBorradoDocumento(null)).toBeNull()
  })
})

describe('pagoAlContado', () => {
  it('factura: pago por el total, a la fecha del documento', () => {
    expect(pagoAlContado('factura', 'f1', 119000, '2026-10-07')).toEqual({
      id_factura: 'f1',
      monto: 119000,
      fecha_pago: '2026-10-07',
      notas: 'Pago al contado',
    })
  })

  it('boleta: usa id_boleta', () => {
    expect(pagoAlContado('boleta', 'b1', 5000, '2026-10-01')).toEqual({
      id_boleta: 'b1',
      monto: 5000,
      fecha_pago: '2026-10-01',
      notas: 'Pago al contado',
    })
  })

  it('total como texto de numeric de la base', () => {
    expect(pagoAlContado('factura', 'f1', '119000.00', '2026-10-07').monto).toBe(119000)
  })

  it('total 0, negativo, vacío o no numérico: no hay pago', () => {
    for (const total of [0, -5, '0', '0.00', '', null, undefined, 'abc']) {
      expect(pagoAlContado('factura', 'f1', total, '2026-10-07')).toBeNull()
    }
  })
})

describe('mensajePagoCreacion', () => {
  const pago = { monto: 119000 }

  it('pago registrado: lo menciona con el monto', () => {
    expect(mensajePagoCreacion({ alContado: true, pago })).toBe('Pago registrado por $119.000.')
  })

  it('desmarcado: queda pendiente', () => {
    expect(mensajePagoCreacion({ alContado: false, pago: null })).toBe('Queda pendiente de pago.')
  })

  it('al contado pero sin pago por total 0: no agrega nada', () => {
    expect(mensajePagoCreacion({ alContado: true, pago: null })).toBe('')
  })

  it('falla del pago: avisa que el documento sí se guardó, con el motivo', () => {
    const texto = mensajePagoCreacion({ alContado: true, pago, motivoError: 'sin permiso' })
    expect(texto).toContain('se guardó pero no se pudo registrar el pago')
    expect(texto).toContain('sin permiso')
    expect(texto).toContain('Cuotas/Pagos')
  })
})
