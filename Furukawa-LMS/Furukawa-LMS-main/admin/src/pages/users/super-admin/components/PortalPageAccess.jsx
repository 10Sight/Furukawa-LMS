import React from 'react';
import { IconLayoutGrid } from '@tabler/icons-react';

// Portal & page access for a custom role (customRole.allowedPages).
// `portals` comes from GET /api/roles-permissions: each is
// { key, name, description, pages: [{ key, name, description, requires? }] }.
// Ticking a page that needs a permission to show anything (`requires`) hands
// that permission back too, so the page isn't granted empty.
const PortalPageAccess = ({ portals = [], allowedPages = [], onChange, roleColor, disabled }) => {
  if (!portals.length) return null;

  const requiredFor = (pages) => [...new Set(pages.map(p => p.requires).filter(Boolean))];

  const togglePage = (page) => {
    if (allowedPages.includes(page.key)) onChange(allowedPages.filter(k => k !== page.key), []);
    else onChange([...allowedPages, page.key], requiredFor([page]));
  };

  const togglePortal = (portal) => {
    const keys = portal.pages.map(p => p.key);
    const allSelected = keys.every(k => allowedPages.includes(k));
    if (allSelected) onChange(allowedPages.filter(k => !keys.includes(k)), []);
    else onChange([...new Set([...allowedPages, ...keys])], requiredFor(portal.pages));
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <IconLayoutGrid size={18} className="text-gray-500" />
        <h3 className="font-semibold text-gray-800">Portal & Page Access</h3>
      </div>
      {portals.map(portal => {
        const keys = portal.pages.map(p => p.key);
        const selected = keys.filter(k => allowedPages.includes(k));
        const allSelected = selected.length === keys.length;
        const someSelected = selected.length > 0 && !allSelected;
        return (
          <div key={portal.key} className="border border-gray-200 rounded-lg overflow-hidden">
            <label className={`bg-gray-50 px-4 py-3 flex items-center gap-3 select-none ${disabled ? 'cursor-default' : 'cursor-pointer'}`}>
              <input
                type="checkbox"
                checked={allSelected}
                ref={(el) => { if (el) el.indeterminate = someSelected; }}
                onChange={() => togglePortal(portal)}
                disabled={disabled}
                className={`w-4 h-4 rounded ${disabled ? 'cursor-not-allowed' : 'cursor-pointer'}`}
                style={{ accentColor: roleColor }}
              />
              <span className="font-medium text-gray-800">{portal.name}</span>
              {portal.description && <span className="text-xs text-gray-400 truncate">{portal.description}</span>}
              <span className="ml-auto text-xs text-gray-500 bg-gray-200 px-2 py-0.5 rounded-full shrink-0">
                {selected.length}/{keys.length}
              </span>
            </label>
            <div className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-2 border-t border-gray-100">
              {portal.pages.map(page => (
                <label key={page.key} className={`flex items-start gap-2 group ${disabled ? 'cursor-default' : 'cursor-pointer'}`}>
                  <input
                    type="checkbox"
                    checked={allowedPages.includes(page.key)}
                    onChange={() => togglePage(page)}
                    disabled={disabled}
                    className={`mt-0.5 w-4 h-4 rounded ${disabled ? 'cursor-not-allowed' : 'cursor-pointer'}`}
                    style={{ accentColor: roleColor }}
                  />
                  <div>
                    <p className="text-sm font-medium text-gray-700 group-hover:text-gray-900">{page.name}</p>
                    {page.description && <p className="text-xs text-gray-400">{page.description}</p>}
                  </div>
                </label>
              ))}
            </div>
          </div>
        );
      })}
      <p className="text-xs text-gray-400">
        Pages decide what a user with this role can open. Ticking a page also selects the &quot;view&quot; permission it needs below.
      </p>
    </div>
  );
};

export default PortalPageAccess;
