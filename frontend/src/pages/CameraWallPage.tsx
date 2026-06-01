import { useEffect, useMemo, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Minus, MonitorPlay, Plus } from 'lucide-react';
import { api, type Printer } from '../api/client';

const STORAGE_KEY = 'cameraWallState';
const DEFAULT_ROWS = 2;
const DEFAULT_COLUMNS = 2;

interface CameraWallStorageState {
  rows?: number;
  columns?: number;
  visiblePrinterIds?: number[];
}

function normalizeCount(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 1
    ? Math.floor(value)
    : fallback;
}

function loadStoredState(): Required<Pick<CameraWallStorageState, 'rows' | 'columns'>> & {
  visiblePrinterIds: number[];
  hasVisiblePrinterIds: boolean;
} {
  try {
    if (typeof window === 'undefined') throw new Error('window unavailable');
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return {
        rows: DEFAULT_ROWS,
        columns: DEFAULT_COLUMNS,
        visiblePrinterIds: [],
        hasVisiblePrinterIds: false,
      };
    }

    const parsed = JSON.parse(raw) as CameraWallStorageState;
    const visiblePrinterIds = Array.isArray(parsed.visiblePrinterIds)
      ? parsed.visiblePrinterIds.filter((id): id is number => Number.isInteger(id) && id > 0)
      : [];

    return {
      rows: normalizeCount(parsed.rows, DEFAULT_ROWS),
      columns: normalizeCount(parsed.columns, DEFAULT_COLUMNS),
      visiblePrinterIds,
      hasVisiblePrinterIds: Array.isArray(parsed.visiblePrinterIds),
    };
  } catch {
    return {
      rows: DEFAULT_ROWS,
      columns: DEFAULT_COLUMNS,
      visiblePrinterIds: [],
      hasVisiblePrinterIds: false,
    };
  }
}

function saveState(rows: number, columns: number, visiblePrinterIds: number[]) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({
      rows,
      columns,
      visiblePrinterIds,
    })
  );
}

function getPrinterLabel(printer: Printer) {
  return printer.model ? `${printer.name} (${printer.model})` : printer.name;
}

export function CameraWallPage() {
  const { t } = useTranslation();
  const initialState = useMemo(loadStoredState, []);
  const initializedVisiblePrinterIds = useRef(initialState.hasVisiblePrinterIds);
  const [rows, setRows] = useState(initialState.rows);
  const [columns, setColumns] = useState(initialState.columns);
  const [visiblePrinterIds, setVisiblePrinterIds] = useState<number[]>(initialState.visiblePrinterIds);

  const { data: printers = [], isLoading, isError } = useQuery({
    queryKey: ['printers'],
    queryFn: api.getPrinters,
  });

  useEffect(() => {
    if (initializedVisiblePrinterIds.current || printers.length === 0) return;
    setVisiblePrinterIds(printers.map((printer) => printer.id));
    initializedVisiblePrinterIds.current = true;
  }, [printers]);

  useEffect(() => {
    if (!initializedVisiblePrinterIds.current) return;
    saveState(rows, columns, visiblePrinterIds);
  }, [rows, columns, visiblePrinterIds]);

  const visibleIdSet = useMemo(() => new Set(visiblePrinterIds), [visiblePrinterIds]);
  const selectedPrinters = useMemo(
    () => printers.filter((printer) => visibleIdSet.has(printer.id)),
    [printers, visibleIdSet]
  );
  const slotCount = rows * columns;
  const mountedPrinters = selectedPrinters.slice(0, slotCount);
  const emptySlotCount = Math.max(0, slotCount - mountedPrinters.length);

  const updateRows = (delta: number) => {
    setRows((current) => Math.max(1, current + delta));
  };

  const updateColumns = (delta: number) => {
    setColumns((current) => Math.max(1, current + delta));
  };

  const togglePrinter = (printerId: number) => {
    initializedVisiblePrinterIds.current = true;
    setVisiblePrinterIds((current) =>
      current.includes(printerId)
        ? current.filter((id) => id !== printerId)
        : [...current, printerId]
    );
  };

  const selectAllPrinters = () => {
    initializedVisiblePrinterIds.current = true;
    setVisiblePrinterIds(printers.map((printer) => printer.id));
  };

  const deselectAllPrinters = () => {
    initializedVisiblePrinterIds.current = true;
    setVisiblePrinterIds([]);
  };

  return (
    <div className="min-h-[calc(100vh-3.5rem)] bg-bambu-dark text-white flex flex-col">
      <div className="sticky top-0 z-20 border-b border-bambu-dark-tertiary bg-bambu-dark-secondary/95 backdrop-blur">
        <div className="px-4 py-3 flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
          <div className="flex items-center gap-3">
            <MonitorPlay className="w-6 h-6 text-bambu-green" />
            <div>
              <h1 className="text-xl font-bold">{t('cameraWall.title', { defaultValue: 'Camera Wall' })}</h1>
              <p className="text-sm text-bambu-gray">
                {t('cameraWall.summary', {
                  defaultValue: '{{mounted}} mounted of {{selected}} selected',
                  mounted: mountedPrinters.length,
                  selected: selectedPrinters.length,
                })}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center rounded-lg border border-bambu-dark-tertiary bg-bambu-dark overflow-hidden">
              <span className="px-3 text-sm text-bambu-gray">{t('cameraWall.rows', { defaultValue: 'Rows' })}</span>
              <button
                type="button"
                onClick={() => updateRows(-1)}
                className="p-2 hover:bg-bambu-dark-tertiary disabled:opacity-40"
                disabled={rows <= 1}
                aria-label={t('cameraWall.decreaseRows', { defaultValue: 'Decrease rows' })}
              >
                <Minus className="w-4 h-4" />
              </button>
              <span
                className="min-w-8 text-center text-sm font-mono tabular-nums"
                aria-label={t('cameraWall.rowCount', { defaultValue: 'Row count' })}
              >
                {rows}
              </span>
              <button
                type="button"
                onClick={() => updateRows(1)}
                className="p-2 hover:bg-bambu-dark-tertiary"
                aria-label={t('cameraWall.increaseRows', { defaultValue: 'Increase rows' })}
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>

            <div className="flex items-center rounded-lg border border-bambu-dark-tertiary bg-bambu-dark overflow-hidden">
              <span className="px-3 text-sm text-bambu-gray">{t('cameraWall.columns', { defaultValue: 'Columns' })}</span>
              <button
                type="button"
                onClick={() => updateColumns(-1)}
                className="p-2 hover:bg-bambu-dark-tertiary disabled:opacity-40"
                disabled={columns <= 1}
                aria-label={t('cameraWall.decreaseColumns', { defaultValue: 'Decrease columns' })}
              >
                <Minus className="w-4 h-4" />
              </button>
              <span
                className="min-w-8 text-center text-sm font-mono tabular-nums"
                aria-label={t('cameraWall.columnCount', { defaultValue: 'Column count' })}
              >
                {columns}
              </span>
              <button
                type="button"
                onClick={() => updateColumns(1)}
                className="p-2 hover:bg-bambu-dark-tertiary"
                aria-label={t('cameraWall.increaseColumns', { defaultValue: 'Increase columns' })}
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        <div className="px-4 pb-3">
          <div className="flex flex-wrap items-center gap-2">
            {isLoading && (
              <span className="text-sm text-bambu-gray">
                {t('cameraWall.loadingPrinters', { defaultValue: 'Loading printers...' })}
              </span>
            )}
            {isError && (
              <span className="text-sm text-red-400">
                {t('cameraWall.loadError', { defaultValue: 'Unable to load printers' })}
              </span>
            )}
            {!isLoading && !isError && printers.length === 0 && (
              <span className="text-sm text-bambu-gray">
                {t('common.noPrinters', { defaultValue: 'No printers configured' })}
              </span>
            )}
            {printers.length > 0 && (
              <>
                <button
                  type="button"
                  onClick={selectAllPrinters}
                  className="px-3 py-1.5 rounded-md text-xs font-medium bg-bambu-dark border border-bambu-dark-tertiary text-bambu-gray hover:text-white hover:border-bambu-green/60"
                >
                  {t('common.selectAll', { defaultValue: 'Select All' })}
                </button>
                <button
                  type="button"
                  onClick={deselectAllPrinters}
                  className="px-3 py-1.5 rounded-md text-xs font-medium bg-bambu-dark border border-bambu-dark-tertiary text-bambu-gray hover:text-white hover:border-bambu-green/60"
                >
                  {t('common.deselectAll', { defaultValue: 'Deselect All' })}
                </button>
                {printers.map((printer) => (
                  <label
                    key={printer.id}
                    className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md border border-bambu-dark-tertiary bg-bambu-dark text-sm text-bambu-gray-light hover:border-bambu-green/60"
                  >
                    <input
                      type="checkbox"
                      checked={visibleIdSet.has(printer.id)}
                      onChange={() => togglePrinter(printer.id)}
                      className="w-4 h-4 rounded border-bambu-dark-tertiary bg-bambu-dark-secondary text-bambu-green focus:ring-bambu-green"
                    />
                    <span className="max-w-48 truncate">{getPrinterLabel(printer)}</span>
                  </label>
                ))}
              </>
            )}
          </div>
        </div>
      </div>

      <div
        className="flex-1 min-h-[480px] p-3 grid gap-3"
        style={{
          gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
          gridTemplateRows: `repeat(${rows}, minmax(280px, 1fr))`,
        }}
        aria-label={t('cameraWall.gridLabel', { defaultValue: 'Camera wall grid' })}
      >
        {mountedPrinters.map((printer) => (
          <div
            key={printer.id}
            className="min-w-0 min-h-0 rounded-lg overflow-hidden border border-bambu-dark-tertiary bg-black"
          >
            <iframe
              title={t('cameraWall.iframeTitle', {
                defaultValue: 'Camera {{name}}',
                name: printer.name,
              })}
              src={`/camera/${printer.id}`}
              className="w-full h-full border-0 bg-black"
              loading="eager"
            />
          </div>
        ))}
        {Array.from({ length: emptySlotCount }, (_, index) => (
          <div
            key={`empty-${index}`}
            className="min-h-[280px] rounded-lg border border-dashed border-bambu-dark-tertiary bg-bambu-dark-secondary/40 flex items-center justify-center text-sm text-bambu-gray"
            aria-label={t('cameraWall.emptySlot', { defaultValue: 'Empty camera slot' })}
          >
            {t('cameraWall.emptySlot', { defaultValue: 'Empty camera slot' })}
          </div>
        ))}
      </div>
    </div>
  );
}
