/**
 * Tests for the CameraWallPage component.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { render } from '../utils';
import { server } from '../mocks/server';
import { CameraWallPage } from '../../pages/CameraWallPage';

const mockPrinters = [
  { id: 1, name: 'Alpha', serial_number: 'A', ip_address: '192.168.1.1', access_code: '11111111', model: 'X1C' },
  { id: 2, name: 'Beta', serial_number: 'B', ip_address: '192.168.1.2', access_code: '22222222', model: 'P1S' },
  { id: 3, name: 'Gamma', serial_number: 'C', ip_address: '192.168.1.3', access_code: '33333333', model: 'A1' },
  { id: 4, name: 'Delta', serial_number: 'D', ip_address: '192.168.1.4', access_code: '44444444', model: 'A1 mini' },
  { id: 5, name: 'Echo', serial_number: 'E', ip_address: '192.168.1.5', access_code: '55555555', model: 'P1P' },
];

describe('CameraWallPage', () => {
  let localStorageData: Record<string, string>;

  beforeEach(() => {
    localStorageData = {};
    vi.mocked(window.localStorage.getItem).mockImplementation((key: string) => localStorageData[key] ?? null);
    vi.mocked(window.localStorage.setItem).mockImplementation((key: string, value: string) => {
      localStorageData[key] = String(value);
    });
    vi.mocked(window.localStorage.removeItem).mockImplementation((key: string) => {
      delete localStorageData[key];
    });
    vi.mocked(window.localStorage.clear).mockImplementation(() => {
      localStorageData = {};
    });

    server.use(
      http.get('/api/v1/printers/', () => HttpResponse.json(mockPrinters))
    );
  });

  it('defaults to a 2x2 wall and only mounts occupied visible slots', async () => {
    render(<CameraWallPage />);

    await waitFor(() => {
      expect(screen.getByTitle('Camera Alpha')).toBeInTheDocument();
      expect(screen.getByTitle('Camera Delta')).toBeInTheDocument();
    });

    expect(screen.getAllByTitle(/^Camera /)).toHaveLength(4);
    expect(screen.queryByTitle('Camera Echo')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Empty camera slot')).not.toBeInTheDocument();
  });

  it('unmounts unchecked cameras and backfills with the next selected printer', async () => {
    const user = userEvent.setup();
    render(<CameraWallPage />);

    const beta = await screen.findByLabelText('Beta (P1S)');
    await user.click(beta);

    await waitFor(() => {
      expect(screen.queryByTitle('Camera Beta')).not.toBeInTheDocument();
      expect(screen.getByTitle('Camera Echo')).toBeInTheDocument();
    });

    expect(screen.getAllByTitle(/^Camera /)).toHaveLength(4);
  });

  it('persists layout and selected printers in localStorage', async () => {
    window.localStorage.setItem('cameraWallState', JSON.stringify({
      rows: 1,
      columns: 1,
      visiblePrinterIds: [2],
    }));

    const user = userEvent.setup();
    render(<CameraWallPage />);

    await waitFor(() => {
      expect(screen.getByTitle('Camera Beta')).toBeInTheDocument();
      expect(screen.queryByTitle('Camera Alpha')).not.toBeInTheDocument();
    });

    await user.click(screen.getByLabelText('Increase columns'));

    await waitFor(() => {
      expect(JSON.parse(window.localStorage.getItem('cameraWallState') || '{}')).toEqual({
        rows: 1,
        columns: 2,
        visiblePrinterIds: [2],
      });
    });
  });

  it('does not impose an upper grid limit', async () => {
    const user = userEvent.setup();
    render(<CameraWallPage />);

    await screen.findByTitle('Camera Alpha');

    for (let i = 0; i < 5; i += 1) {
      await user.click(screen.getByLabelText('Increase columns'));
    }

    expect(screen.getByLabelText('Column count')).toHaveTextContent('7');
  });
});
