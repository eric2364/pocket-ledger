"""Synthetic OOXML fixtures contain no personal workbook data."""
import hashlib
import importlib.util
import tempfile
import unittest
from pathlib import Path
from zipfile import ZipFile

SPEC = importlib.util.spec_from_file_location('migration', Path(__file__).parents[2] / 'scripts/migrate_workbook.py')
migration = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(migration)


def fixture(path):
    # Build tiny XML fixtures using stdlib; never store a copy of private records in tests.
    namespace = 'http://schemas.openxmlformats.org/spreadsheetml/2006/main'
    sheets = [
      ('2025_01', 'visible', '''<row r="4"><c r="M4"><v>100</v></c></row>
      <row r="5"><c r="M5"><v>15.005</v></c></row>
      <row r="6"><c r="B6" t="d"><v>2024-12-31T00:00:00</v></c>
      <c r="C6" t="inlineStr"><is><t>測試餐飲</t></is></c><c r="D6"><v>10.005</v></c>
      <c r="G6" t="d"><v>2025-01-01T00:00:00</v></c><c r="H6" t="inlineStr"><is><t>Salary</t></is></c><c r="I6"><v>100</v></c>
      <c r="P6" t="inlineStr"><is><t>測試餐飲</t></is></c><c r="R6"><v>15.005</v></c></row>
      <row r="7"><c r="B7" t="d"><v>2025-01-02T00:00:00</v></c><c r="C7" t="inlineStr"><is><t>測試餐飲</t></is></c><c r="D7"><f>2+3</f><v>5</v></c></row>'''),
      ('Saving', 'visible', '''<row r="2"><c r="D2"><v>2021</v></c><c r="E2"><v>2022</v></c><c r="F2"><v>2023</v></c><c r="G2"><v>2024</v></c><c r="H2"><v>2025</v></c><c r="I2"><v>2026</v></c></row>
      <row r="27"><c r="C27" t="inlineStr"><is><t>Car</t></is></c><c r="H27"><f>SUM(H28:H31)</f><v>30</v></c></row>
      <row r="28"><c r="C28" t="inlineStr"><is><t>Licence</t></is></c><c r="H28"><v>10</v></c></row>'''),
      ('Hidden detail', 'hidden', '<row r="1"><c r="A1" t="inlineStr"><is><t>保留文字</t></is></c></row>'),
    ]
    with ZipFile(path,'w') as z:
        overrides = ''.join(f'<Override PartName="/xl/worksheets/sheet{i}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>' for i in range(1,4))
        z.writestr('[Content_Types].xml',f'<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>{overrides}</Types>')
        z.writestr('_rels/.rels','<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>')
        entries = ''.join(f'<sheet name="{name}" sheetId="{i}" state="{state}" r:id="rId{i}"/>' for i,(name,state,_) in enumerate(sheets,1))
        z.writestr('xl/workbook.xml',f'<workbook xmlns="{namespace}" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>{entries}</sheets></workbook>')
        relations = ''.join(f'<Relationship Id="rId{i}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet{i}.xml"/>' for i in range(1,4))
        z.writestr('xl/_rels/workbook.xml.rels',f'<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">{relations}</Relationships>')
        for i,(_,_,xml) in enumerate(sheets,1):
            z.writestr(f'xl/worksheets/sheet{i}.xml',f'<worksheet xmlns="{namespace}"><sheetData>{xml}</sheetData></worksheet>')


class MigrationTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.path = Path(self.temp.name) / 'synthetic.xlsx'
        fixture(self.path)
        self.data,self.report = migration.migrate(self.path)

    def tearDown(self):
        self.temp.cleanup()

    def test_deterministic_and_read_only(self):
        before = hashlib.sha256(self.path.read_bytes()).hexdigest()
        again,report = migration.migrate(self.path)
        self.assertEqual(self.data,again)
        self.assertEqual(self.report,report)
        self.assertEqual(before,hashlib.sha256(self.path.read_bytes()).hexdigest())

    def test_no_summary_or_subrow_double_count(self):
        self.assertEqual(len(self.data['transactions']),4)
        adjustments = [t for t in self.data['transactions'] if t['kind']=='adjustment']
        self.assertEqual([t['sourceReference'] for t in adjustments],['H27'])
        self.assertEqual(adjustments[0]['amountMinor'],-3000)
        self.assertIsNone(adjustments[0]['date'])
        self.assertEqual(adjustments[0]['reportingPeriod'],'2025')

    def test_chinese_and_reporting_period_preserved(self):
        t = next(t for t in self.data['transactions'] if t['sourceReference']=='B6:D6')
        self.assertEqual(t['originalCategory'],'測試餐飲')
        self.assertEqual(t['date'],'2024-12-31')
        self.assertEqual(t['reportingPeriod'],'2025-01')

    def test_caches_formulas_and_hidden_sheet_preserved(self):
        source = self.data['sourceArchive']['sheets']
        self.assertEqual(source[2]['state'],'hidden')
        cell = next(c for c in source[0]['cells'] if c['reference']=='D7')
        self.assertEqual(cell['formula'],'=2+3')
        self.assertEqual(cell['cachedValue'],5)

    def test_decimal_rounding_and_reconciliation(self):
        self.assertEqual(migration.minor(10.005),1001)
        self.assertEqual(migration.minor(-10.005),-1001)
        expense = next(r for r in self.report['reconciliations'] if r['kind']=='expense')
        self.assertEqual(expense['rawDifferenceMinor'],0)
        self.assertEqual(expense['status'],'match')
        with self.assertRaises(ValueError):
            migration.minor(True)


if __name__=='__main__':
    unittest.main()
