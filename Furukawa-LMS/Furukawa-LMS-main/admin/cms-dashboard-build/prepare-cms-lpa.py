"""Prepare the minimal CMS wiring for review without modifying the host apps."""
from pathlib import Path
import difflib
import json

integration = Path(__file__).resolve().parent
repo = integration.parents[1]
changes = []
for app in ('admin', 'portal'):
    for relative in ('src/constants/navigation/pageRegistry.js', 'src/routes/AppRoutes.jsx', 'src/pages/cms/FmeDashboardPage.jsx'):
        file = repo / app / relative
        before = file.read_text(encoding='utf-8')
        after = before
        if relative.endswith('pageRegistry.js'):
            lines = after.splitlines(keepends=True)
            anchor = next((i for i, line in enumerate(lines) if 'interlink' in line.lower()), None)
            if anchor is None:
                anchor = next(i for i, line in enumerate(lines) if 'key: "cms-process-audit"' in line)
            lines.insert(anchor + 1, '    { key: "cms-lpa", label: "LPA", layout: "cms", link: "/cms/lpa", icon: "IconTable" },\n')
            after = ''.join(lines)
        elif relative.endswith('AppRoutes.jsx'):
            anchor = '            <Route path="process-audit" element={<FmeDashboardPage key="process-audit" page="process-audit" />} />'
            assert anchor in after
            after = after.replace(anchor, anchor + '\n            <Route path="lpa" element={<FmeDashboardPage key="lpa" page="lpa" />} />', 1)
        else:
            after = after.replace("'process-audit': 'Process Audit'", "'process-audit': 'Process Audit', lpa: 'LPA'")
            after = after.replace("        const route = page === 'pdca' && sheet ? `/sheet/${encodeURIComponent(sheet)}` : '/';", "        const section = new URLSearchParams(search).get('section');\n        const lpaSection = section === 'cc' ? 'cc' : 'assembly';\n        const route = page === 'pdca' && sheet ? `/sheet/${encodeURIComponent(sheet)}` : page === 'lpa' ? `/${lpaSection}` : '/';")
            anchor = "            if (event.data.type !== 'fme-cms-route') return;"
            new = """            if (event.data.type === 'fme-cms-open-pdca' && page === 'lpa' && typeof event.data.sheet === 'string' && ['assembly', 'cc'].includes(event.data.section)) {
                navigate(`/cms/pdca?sheet=${encodeURIComponent(event.data.sheet)}`);
                return;
            }
            if (event.data.type === 'fme-cms-open-lpa' && page === 'pdca' && ['assembly', 'cc'].includes(event.data.section)) {
                navigate(`/cms/lpa?section=${event.data.section}`);
                return;
            }
            if (event.data.type !== 'fme-cms-route') return;
            if (page === 'lpa') return; // LPA maintains its worksheet route inside the frame.
""".rstrip()
            assert anchor in after
            after = after.replace(anchor, new)
        assert after != before
        changes.append({'path': str(file), 'before': before, 'after': after})

preview = integration / '.lpa-preview'
preview.mkdir(exist_ok=True)
(preview / 'cms-wiring.json').write_text(json.dumps(changes), encoding='utf-8')
diff = ''.join(''.join(difflib.unified_diff(change['before'].splitlines(keepends=True), change['after'].splitlines(keepends=True), fromfile=str(Path(change['path']).relative_to(repo)), tofile=str(Path(change['path']).relative_to(repo)))) for change in changes)
(preview / 'cms-wiring.patch').write_text(diff, encoding='utf-8')
print(f'Prepared {len(changes)} small CMS wiring changes for review; host files are unchanged.')
