import { useMemo, useState } from 'react'
import {
  useReactTable,
  getCoreRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  flexRender,
  createColumnHelper,
} from '@tanstack/react-table'
import { useStore } from '../store/useStore.js'
import { sendCommand } from '../api/apiService.js'

const ch = createColumnHelper()

function StatusBadge({ connected }) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 5,
      fontSize: 11, fontWeight: 500,
      padding: '3px 8px', borderRadius: 20,
      background: connected ? 'var(--green-10)' : 'var(--card-alt)',
      color: connected ? 'var(--green)' : 'var(--text3)',
      border: connected ? '1px solid rgba(63,185,80,0.2)' : '1px solid var(--border-sub)',
    }}>
      <span style={{
        width: 6, height: 6, borderRadius: '50%',
        background: connected ? 'var(--green)' : 'var(--text3)',
        boxShadow: connected ? '0 0 5px rgba(63,185,80,0.5)' : 'none',
      }} />
      {connected ? 'Online' : 'Offline'}
    </span>
  )
}

function PlanBadge({ plan }) {
  return (
    <span style={{
      fontSize: 10, fontWeight: 600,
      padding: '3px 8px', borderRadius: 4,
      background: plan === 'PREMIUM' ? 'var(--blue-10)' : 'var(--card-alt)',
      color: plan === 'PREMIUM' ? 'var(--blue)' : 'var(--text3)',
    }}>
      {plan}
    </span>
  )
}

export default function DevicesPage() {
  const { fleet, user } = useStore()
  const [globalFilter, setGlobalFilter] = useState('')
  const [cmdResult, setCmdResult] = useState({})

  const handleCmd = async (deviceId, command) => {
    try {
      const { data } = await sendCommand(deviceId, command)
      setCmdResult((r) => ({ ...r, [deviceId]: data.delivered ? '✓ Enviado' : '⏳ Encolado' }))
    } catch {
      setCmdResult((r) => ({ ...r, [deviceId]: '✗ Error' }))
    }
    setTimeout(() => setCmdResult((r) => { const n = { ...r }; delete n[deviceId]; return n }), 3000)
  }

  const columns = useMemo(() => [
    ch.accessor('alias', {
      header: 'Moto',
      cell: (i) => (
        <div>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text1)' }}>{i.getValue()}</div>
          <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 2, fontFamily: 'monospace' }}>
            {i.row.original.placa}
          </div>
        </div>
      ),
    }),
    ch.accessor('deviceId', {
      header: 'Device ID',
      cell: (i) => (
        <span style={{ fontFamily: 'monospace', fontSize: 11, color: 'var(--text2)' }}>
          {i.getValue()}
        </span>
      ),
    }),
    ch.accessor('email', {
      header: 'Usuario',
      cell: (i) => <span style={{ fontSize: 12, color: 'var(--text2)' }}>{i.getValue()}</span>,
    }),
    ch.accessor('connected', {
      header: 'Estado',
      cell: (i) => <StatusBadge connected={i.getValue()} />,
    }),
    ch.accessor('plan', {
      header: 'Plan',
      cell: (i) => <PlanBadge plan={i.getValue()} />,
    }),
    ch.accessor('speed', {
      header: 'Vel.',
      cell: (i) => (
        <span style={{ fontSize: 12, color: i.getValue() > 0 ? 'var(--text1)' : 'var(--text3)' }}>
          {i.getValue() ?? 0} km/h
        </span>
      ),
    }),
    ch.accessor('lastSeen', {
      header: 'Última vez',
      cell: (i) => {
        const v = i.getValue()
        return (
          <span style={{ fontSize: 11, color: 'var(--text3)' }}>
            {v ? new Date(v).toLocaleString('es-PE', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '—'}
          </span>
        )
      },
    }),
    ch.display({
      id: 'actions',
      header: 'Acciones',
      cell: ({ row }) => {
        const d = row.original
        if (cmdResult[d.deviceId]) {
          return (
            <span style={{
              fontSize: 11, fontWeight: 600,
              color: cmdResult[d.deviceId].startsWith('✓') ? 'var(--green)' : cmdResult[d.deviceId].startsWith('✗') ? 'var(--armed)' : 'var(--text2)',
            }}>
              {cmdResult[d.deviceId]}
            </span>
          )
        }
        return (
          <div style={{ display: 'flex', gap: 6 }}>
            <button
              onClick={() => handleCmd(d.deviceId, 'ARM')}
              style={{
                fontSize: 11, fontWeight: 600,
                padding: '4px 10px', borderRadius: 6,
                border: '1px solid rgba(47,129,247,0.3)',
                background: 'var(--blue-10)', color: 'var(--blue)',
                cursor: 'pointer',
              }}
            >ARM</button>
            <button
              onClick={() => handleCmd(d.deviceId, 'DISARM')}
              style={{
                fontSize: 11, fontWeight: 600,
                padding: '4px 10px', borderRadius: 6,
                border: '1px solid var(--border)',
                background: 'var(--card-alt)', color: 'var(--text2)',
                cursor: 'pointer',
              }}
            >DISARM</button>
            {user?.role === 'SUPER_ADMIN' && (
              <button
                onClick={() => handleCmd(d.deviceId, 'ENGINE_CUT')}
                style={{
                  fontSize: 11, fontWeight: 600,
                  padding: '4px 10px', borderRadius: 6,
                  border: '1px solid rgba(229,72,77,0.3)',
                  background: 'var(--armed-10)', color: 'var(--armed)',
                  cursor: 'pointer',
                }}
              >CORTE</button>
            )}
          </div>
        )
      },
    }),
  ], [cmdResult, user])

  const table = useReactTable({
    data: fleet,
    columns,
    state: { globalFilter },
    onGlobalFilterChange: setGlobalFilter,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    initialState: { pagination: { pageSize: 10 } },
  })

  return (
    <div style={{ padding: 24, background: 'var(--bg)', minHeight: '100vh' }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 24, gap: 16 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: 'var(--text1)' }}>Dispositivos</h1>
          <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--text2)' }}>
            {fleet.length} dispositivos en la flota · {fleet.filter(d => d.connected).length} online
          </p>
        </div>
        <input
          value={globalFilter}
          onChange={(e) => setGlobalFilter(e.target.value)}
          placeholder="Buscar dispositivo…"
          style={{
            fontSize: 13, padding: '9px 14px',
            borderRadius: 10, border: '1px solid var(--border)',
            background: 'var(--card)', color: 'var(--text1)',
            outline: 'none', width: 240,
            transition: 'border-color 0.15s',
          }}
          onFocus={e => e.target.style.borderColor = 'var(--blue)'}
          onBlur={e => e.target.style.borderColor = 'var(--border)'}
        />
      </div>

      {/* Table */}
      <div style={{
        background: 'var(--card)',
        border: '1px solid var(--border)',
        borderRadius: 14,
        overflow: 'hidden',
      }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            {table.getHeaderGroups().map((hg) => (
              <tr key={hg.id} style={{ borderBottom: '1px solid var(--border)' }}>
                {hg.headers.map((h) => (
                  <th
                    key={h.id}
                    onClick={h.column.getToggleSortingHandler()}
                    style={{
                      padding: '12px 16px',
                      textAlign: 'left',
                      fontSize: 11, fontWeight: 600,
                      color: 'var(--text2)',
                      userSelect: 'none',
                      cursor: h.column.getCanSort() ? 'pointer' : 'default',
                      whiteSpace: 'nowrap',
                      background: 'var(--card-alt)',
                    }}
                  >
                    {flexRender(h.column.columnDef.header, h.getContext())}
                    {h.column.getIsSorted() === 'asc' ? ' ↑' : h.column.getIsSorted() === 'desc' ? ' ↓' : ''}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody>
            {table.getRowModel().rows.length === 0 ? (
              <tr>
                <td colSpan={columns.length} style={{ padding: '40px', textAlign: 'center' }}>
                  <div style={{ fontSize: 28, marginBottom: 8 }}>📡</div>
                  <p style={{ margin: 0, fontSize: 13, color: 'var(--text3)' }}>
                    {globalFilter ? 'Sin resultados para la búsqueda' : 'Sin dispositivos registrados'}
                  </p>
                </td>
              </tr>
            ) : table.getRowModel().rows.map((row) => (
              <tr
                key={row.id}
                style={{ borderBottom: '1px solid var(--border-sub)', transition: 'background 0.1s' }}
                onMouseEnter={e => e.currentTarget.style.background = 'var(--card-alt)'}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
              >
                {row.getVisibleCells().map((cell) => (
                  <td key={cell.id} style={{ padding: '12px 16px', verticalAlign: 'middle' }}>
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>

        {/* Pagination */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '12px 16px',
          borderTop: '1px solid var(--border)',
          fontSize: 12, color: 'var(--text2)',
        }}>
          <span>
            Página {table.getState().pagination.pageIndex + 1} de {Math.max(1, table.getPageCount())}
            {' '}· {table.getFilteredRowModel().rows.length} registros
          </span>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={() => table.previousPage()}
              disabled={!table.getCanPreviousPage()}
              style={{
                padding: '5px 12px', borderRadius: 8,
                border: '1px solid var(--border)',
                background: 'var(--card-alt)', color: 'var(--text2)',
                fontSize: 12, cursor: 'pointer',
                opacity: table.getCanPreviousPage() ? 1 : 0.4,
              }}
            >← Anterior</button>
            <button
              onClick={() => table.nextPage()}
              disabled={!table.getCanNextPage()}
              style={{
                padding: '5px 12px', borderRadius: 8,
                border: '1px solid var(--border)',
                background: 'var(--card-alt)', color: 'var(--text2)',
                fontSize: 12, cursor: 'pointer',
                opacity: table.getCanNextPage() ? 1 : 0.4,
              }}
            >Siguiente →</button>
          </div>
        </div>
      </div>
    </div>
  )
}
