import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Toast } from '../../components/Toast.jsx';
import { MockAppProvider } from '../helpers/mockAppContext.jsx';

// Mock the AppContext module so Toast uses our mock context
vi.mock('../../context/AppContext.jsx', () => import('../helpers/mockAppContext.jsx'));

function renderToast(toast, dispatch = vi.fn()) {
  return render(
    <MockAppProvider value={{ state: { toast }, dispatch }}>
      <Toast />
    </MockAppProvider>
  );
}

describe('Toast component', () => {
  it('does not render when toast is null', () => {
    const { container } = renderToast(null);
    expect(container.firstChild).toBeNull();
  });

  it('renders success toast with correct classes', () => {
    renderToast({ message: 'Saved!', type: 'success' });
    const el = screen.getByText('Saved!').closest('div');
    expect(el).toHaveClass('bg-emerald-950');
    expect(el).not.toHaveClass('bg-red-950');
  });

  it('renders error toast with correct classes', () => {
    renderToast({ message: 'Error!', type: 'error' });
    const el = screen.getByText('Error!').closest('div');
    expect(el).toHaveClass('bg-red-950');
    expect(el).not.toHaveClass('bg-emerald-950');
  });

  it('displays the toast message', () => {
    renderToast({ message: 'Hello world', type: 'success' });
    expect(screen.getByText('Hello world')).toBeInTheDocument();
  });

  it('dispatches SET_TOAST null when close button clicked', () => {
    const dispatch = vi.fn();
    renderToast({ message: 'Test', type: 'success' }, dispatch);
    fireEvent.click(screen.getByRole('button'));
    expect(dispatch).toHaveBeenCalledWith({ type: 'SET_TOAST', payload: null });
  });
});
