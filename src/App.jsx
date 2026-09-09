import { useEffect, useState } from 'react'
import { supabase } from './supabaseClient'

const TIPOS = {
  rapida: { label: 'Rápida' },
  fecha: { label: 'Con fecha' },
  recurrente: { label: 'Recurrente' },
  mantenimiento: { label: 'Mantenimiento' },
  idea: { label: 'Idea' },
}

const UNIDADES = ['días', 'semanas', 'meses']

const FILTROS = [
  ['todas', 'Todas'],
  ['vencida', 'Vencidas'],
  ['hoy', 'Hoy'],
  ['proxima', 'Próximas'],
  ['completada', 'Hechas'],
]

function getSemaforo(item) {
  if (item.estado === 'completado') return 'completada'
  if (item.tipo === 'idea') return 'proxima'

  const fecha = item.tipo === 'mantenimiento' ? item.proxima_fecha : item.fecha_limite
  if (!fecha) return 'hoy' // tarea rápida sin fecha: se trata como algo a hacer ya

  const hoy = new Date()
  hoy.setHours(0, 0, 0, 0)
  const d = new Date(fecha + 'T00:00:00')
  const diffDias = Math.round((d - hoy) / 86400000)

  if (diffDias < 0) return 'vencida'
  if (diffDias === 0) return 'hoy'
  return 'proxima'
}

function notaFor(item, semaforo) {
  if (item.estado === 'completado') return 'Completada'
  if ((item.tipo === 'mantenimiento' || item.tipo === 'recurrente') && item.intervalo_valor) {
    return `Cada ${item.intervalo_valor} ${item.intervalo_unidad}`
  }
  if (semaforo === 'vencida') return 'Vencida'
  if (item.fecha_limite) return item.fecha_limite
  return item.tipo === 'idea' ? 'Algún día' : 'Sin fecha'
}

// Formulario compartido para crear y editar (fecha + recurrencia)
function CamposFecha({ tipo, setTipo, fecha, setFecha, intervaloValor, setIntervaloValor, intervaloUnidad, setIntervaloUnidad }) {
  return (
    <div className="opciones-form">
      <select value={tipo} onChange={(e) => setTipo(e.target.value)}>
        <option value="rapida">Sin fecha (rápida)</option>
        <option value="fecha">Fecha específica</option>
        <option value="recurrente">Recurrente</option>
      </select>

      {(tipo === 'fecha' || tipo === 'recurrente') && (
        <input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} />
      )}

      {tipo === 'recurrente' && (
        <div className="recurrente-campos">
          <span>Cada</span>
          <input
            type="number"
            min="1"
            value={intervaloValor}
            onChange={(e) => setIntervaloValor(e.target.value)}
          />
          <select value={intervaloUnidad} onChange={(e) => setIntervaloUnidad(e.target.value)}>
            {UNIDADES.map((u) => (
              <option key={u} value={u}>{u}</option>
            ))}
          </select>
        </div>
      )}
    </div>
  )
}

export default function App() {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [filtro, setFiltro] = useState('todas')

  // --- estado del formulario de nueva tarea ---
  const [nuevoTexto, setNuevoTexto] = useState('')
  const [mostrarOpciones, setMostrarOpciones] = useState(false)
  const [nuevoTipo, setNuevoTipo] = useState('rapida')
  const [nuevaFecha, setNuevaFecha] = useState('')
  const [nuevoIntervaloValor, setNuevoIntervaloValor] = useState(1)
  const [nuevoIntervaloUnidad, setNuevoIntervaloUnidad] = useState('días')

  // --- estado de edición ---
  const [editandoId, setEditandoId] = useState(null)
  const [editTexto, setEditTexto] = useState('')
  const [editTipo, setEditTipo] = useState('rapida')
  const [editFecha, setEditFecha] = useState('')
  const [editIntervaloValor, setEditIntervaloValor] = useState(1)
  const [editIntervaloUnidad, setEditIntervaloUnidad] = useState('días')

  async function cargarPendientes() {
    setLoading(true)
    const { data, error } = await supabase
      .from('pendientes')
      .select('*')
      .neq('estado', 'archivado')
      .order('created_at', { ascending: false })

    if (error) setError(error.message)
    else setItems(data)
    setLoading(false)
  }

  useEffect(() => {
    cargarPendientes()
  }, [])

  function resetFormNueva() {
    setNuevoTexto('')
    setNuevoTipo('rapida')
    setNuevaFecha('')
    setNuevoIntervaloValor(1)
    setNuevoIntervaloUnidad('días')
    setMostrarOpciones(false)
  }

  async function agregarDesdeInbox() {
    const titulo = nuevoTexto.trim()
    if (!titulo) return

    if ((nuevoTipo === 'fecha' || nuevoTipo === 'recurrente') && !nuevaFecha) {
      setError('Elige una fecha para esta tarea')
      return
    }

    const nuevo = {
      titulo,
      tipo: nuevoTipo,
      prioridad: 'media',
      estado: 'pendiente',
      fecha_limite: nuevoTipo === 'fecha' || nuevoTipo === 'recurrente' ? nuevaFecha : null,
      intervalo_valor: nuevoTipo === 'recurrente' ? Number(nuevoIntervaloValor) || 1 : null,
      intervalo_unidad: nuevoTipo === 'recurrente' ? nuevoIntervaloUnidad : null,
    }

    const { error } = await supabase.from('pendientes').insert(nuevo)

    if (error) {
      setError(error.message)
      return
    }
    resetFormNueva()
    cargarPendientes()
  }

  async function alternarCompletado(item) {
    const nuevoEstado = item.estado === 'completado' ? 'pendiente' : 'completado'
    const { error } = await supabase
      .from('pendientes')
      .update({
        estado: nuevoEstado,
        fecha_completado: nuevoEstado === 'completado' ? new Date().toISOString() : null,
      })
      .eq('id', item.id)

    if (error) {
      setError(error.message)
      return
    }
    cargarPendientes()
  }

  function iniciarEdicion(item) {
    setEditandoId(item.id)
    setEditTexto(item.titulo)
    setEditTipo(item.tipo === 'mantenimiento' || item.tipo === 'idea' ? item.tipo : item.tipo)
    setEditFecha(item.fecha_limite ?? '')
    setEditIntervaloValor(item.intervalo_valor ?? 1)
    setEditIntervaloUnidad(item.intervalo_unidad ?? 'días')
  }

  function cancelarEdicion() {
    setEditandoId(null)
  }

  async function guardarEdicion(item) {
    const titulo = editTexto.trim()
    if (!titulo) return

    if ((editTipo === 'fecha' || editTipo === 'recurrente') && !editFecha) {
      setError('Elige una fecha para esta tarea')
      return
    }

    const cambios = {
      titulo,
      tipo: editTipo,
      fecha_limite: editTipo === 'fecha' || editTipo === 'recurrente' ? editFecha : null,
      intervalo_valor: editTipo === 'recurrente' ? Number(editIntervaloValor) || 1 : null,
      intervalo_unidad: editTipo === 'recurrente' ? editIntervaloUnidad : null,
    }

    const { error } = await supabase.from('pendientes').update(cambios).eq('id', item.id)

    if (error) {
      setError(error.message)
      return
    }
    setEditandoId(null)
    cargarPendientes()
  }

  async function eliminarPendiente(item) {
    const confirmar = window.confirm(`¿Eliminar "${item.titulo}"? Esto no se puede deshacer.`)
    if (!confirmar) return

    const { error } = await supabase.from('pendientes').delete().eq('id', item.id)

    if (error) {
      setError(error.message)
      return
    }
    cargarPendientes()
  }

  const itemsConSemaforo = items.map((i) => ({ ...i, semaforo: getSemaforo(i) }))

  const contadores = {
    vencidas: itemsConSemaforo.filter((i) => i.semaforo === 'vencida' && i.estado !== 'completado').length,
    hoy: itemsConSemaforo.filter((i) => i.semaforo === 'hoy' && i.estado !== 'completado').length,
    hechas: itemsConSemaforo.filter((i) => i.estado === 'completado').length,
  }

  const visibles = itemsConSemaforo.filter((i) => {
    if (filtro === 'todas') return true
    if (filtro === 'completada') return i.estado === 'completado'
    return i.semaforo === filtro && i.estado !== 'completado'
  })

  return (
    <div className="page">
      <h1>Hoy</h1>

      <div className="inbox-wrap">
        <div className="inbox">
          <input
            type="text"
            placeholder="Anota algo rápido..."
            value={nuevoTexto}
            onChange={(e) => setNuevoTexto(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && agregarDesdeInbox()}
          />
          <button
            className={mostrarOpciones ? 'btn-opciones activo' : 'btn-opciones'}
            onClick={() => setMostrarOpciones((o) => !o)}
            aria-label="Fecha y recurrencia"
            title="Fecha y recurrencia"
          >
            📅
          </button>
          <button onClick={agregarDesdeInbox} aria-label="Agregar">+</button>
        </div>

        {mostrarOpciones && (
          <CamposFecha
            tipo={nuevoTipo}
            setTipo={setNuevoTipo}
            fecha={nuevaFecha}
            setFecha={setNuevaFecha}
            intervaloValor={nuevoIntervaloValor}
            setIntervaloValor={setNuevoIntervaloValor}
            intervaloUnidad={nuevoIntervaloUnidad}
            setIntervaloUnidad={setNuevoIntervaloUnidad}
          />
        )}
      </div>

      <div className="resumen">
        <div className="tarjeta-resumen">
          <div className="numero rojo">{contadores.vencidas}</div>
          <div className="etiqueta">Vencidas</div>
        </div>
        <div className="tarjeta-resumen">
          <div className="numero naranja">{contadores.hoy}</div>
          <div className="etiqueta">Para hoy</div>
        </div>
        <div className="tarjeta-resumen">
          <div className="numero verde">{contadores.hechas}</div>
          <div className="etiqueta">Hechas</div>
        </div>
      </div>

      <div className="filtros">
        {FILTROS.map(([key, label]) => (
          <button
            key={key}
            className={filtro === key ? 'filtro activo' : 'filtro'}
            onClick={() => setFiltro(key)}
          >
            {label}
          </button>
        ))}
      </div>

      {error && <p className="error">Error: {error}</p>}
      {loading && <p className="vacio">Cargando...</p>}

      {!loading && visibles.length === 0 && <p className="vacio">Nada por aquí.</p>}

      <div className="lista">
        {visibles.map((item) => {
          const hecho = item.estado === 'completado'
          const enEdicion = editandoId === item.id

          if (enEdicion) {
            return (
              <div className="tarjeta tarjeta-edicion" key={item.id}>
                <input
                  type="text"
                  className="input-edicion"
                  value={editTexto}
                  onChange={(e) => setEditTexto(e.target.value)}
                />
                <CamposFecha
                  tipo={editTipo}
                  setTipo={setEditTipo}
                  fecha={editFecha}
                  setFecha={setEditFecha}
                  intervaloValor={editIntervaloValor}
                  setIntervaloValor={setEditIntervaloValor}
                  intervaloUnidad={editIntervaloUnidad}
                  setIntervaloUnidad={setEditIntervaloUnidad}
                />
                <div className="acciones-edicion">
                  <button className="btn-guardar" onClick={() => guardarEdicion(item)}>Guardar</button>
                  <button className="btn-cancelar" onClick={cancelarEdicion}>Cancelar</button>
                </div>
              </div>
            )
          }

          return (
            <div className="tarjeta" key={item.id}>
              <button
                className={hecho ? 'check hecho' : 'check'}
                onClick={() => alternarCompletado(item)}
                aria-label="Completar"
              >
                {hecho ? '✓' : ''}
              </button>
              <div className="contenido">
                <p className={hecho ? 'titulo hecho' : 'titulo'}>{item.titulo}</p>
                <div className="meta">
                  <span className="tipo">{TIPOS[item.tipo]?.label ?? item.tipo}</span>
                  <span className={`nota nota-${item.semaforo}`}>{notaFor(item, item.semaforo)}</span>
                </div>
              </div>
              <span className={`prioridad prioridad-${item.prioridad}`} />
              <div className="acciones">
                <button className="btn-icono" onClick={() => iniciarEdicion(item)} aria-label="Editar" title="Editar">✎</button>
                <button className="btn-icono" onClick={() => eliminarPendiente(item)} aria-label="Eliminar" title="Eliminar">🗑</button>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
