import path from 'path';
import express from 'express';
import { Pool } from 'pg';
import { fileURLToPath } from 'url';

const app = express();

const PORT = 3000;
const PAGE_SIZE = 5;
const ALLOWED_TYPES = new Set(['Вбудована', 'Окремо стояча', 'Щоглова']);
const COLUMNS = 'address, type, apartments_count, power, last_repair_date';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const pool = new Pool({
  host: 'localhost',
  user: 'username',
  password: 'password',
  database: 'substation_registry',
  port: 5432,
});

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

function getPaginationOffset(page) {
  const validatedPage = Math.max(1, Number(page) || 1);
  const offset = (validatedPage - 1) * PAGE_SIZE;

  return offset;
}

function calcEstimatedLoad(apartmentsCount) {
  return apartmentsCount * 5;
}

app.post('/api/substations', async (req, res) => {
  try {
    const address = req.body.address?.trim();
    const type = req.body.type?.trim();
    const apartmentsCount = Number(req.body.apartments_count);
    const power = Number(req.body.power);
    const lastRepairDate = new Date(req.body.last_repair_date?.trim());

    if (!address) {
      return res.status(400).json({ message: 'Вкажіть адресу.' });
    }

    if (!ALLOWED_TYPES.has(type)) {
      return res.status(400).json({ message: 'Оберіть коректний тип підстанції.' });
    }

    if (isNaN(apartmentsCount) || apartmentsCount <= 0) {
      return res.status(400).json({ message: 'Кількість квартир має бути додатним числом.' });
    }

    if (isNaN(power) || power <= 0) {
      return res.status(400).json({ message: 'Потужність має бути додатним числом.' });
    }

    if (isNaN(lastRepairDate)) {
      return res.status(400).json({ message: 'Вкажіть коректну дату останнього ремонту.' });
    }

    const insertQuery = `
      INSERT INTO substations (${COLUMNS})
      VALUES ($1, $2, $3, $4, $5)
      RETURNING id, ${COLUMNS}
    `;

    const result = await pool.query(insertQuery, [address, type, apartmentsCount, power, lastRepairDate]);
    const created = result.rows[0];
    created.estimated_load = calcEstimatedLoad(created.apartments_count);

    return res.status(201).json(created);
  } catch {
    return res.status(500).json({ message: 'Помилка сервера при збереженні даних.' });
  }
});

app.get('/api/substations', async (req, res) => {
  try {
    const offset = getPaginationOffset(req.query.page);
    const search = req.query.search?.trim() || '';
    const type = req.query.type?.trim() || '';

    const whereParts = [];
    const params = [];

    if (search) {
      params.push(`%${search}%`);
      whereParts.push(`address ILIKE $${params.length}`);
    }

    if (type && type !== 'all') {
      if (!ALLOWED_TYPES.has(type)) {
        return res.status(400).json({ message: 'Некоректний фільтр типу.' });
      }

      params.push(type);
      whereParts.push(`type = $${params.length}`);
    }

    const whereSql = whereParts.length ? `WHERE ${whereParts.join(' AND ')}` : '';

    const countResult = await pool.query(`SELECT COUNT(*)::int AS total FROM substations ${whereSql}`, params);
    const total = countResult.rows[0]?.total || 0;
    const totalPages = total === 0 ? 1 : Math.ceil(total / PAGE_SIZE);

    const listQuery = `
      SELECT id, ${COLUMNS}
      FROM substations
      ${whereSql}
      ORDER BY id DESC
      LIMIT $${params.length + 1}
      OFFSET $${params.length + 2}
    `;

    const listResult = await pool.query(listQuery, [...params, PAGE_SIZE, offset]);
    const items = listResult.rows.map((row) => {
      return {
        ...row,
        estimated_load: calcEstimatedLoad(row.apartments_count),
      };
    });

    return res.json({
      total,
      totalPages,
      items,
    });
  } catch {
    return res.status(500).json({ message: 'Помилка сервера при отриманні даних.' });
  }
});

app.listen(PORT, () => {
  console.log(`Сервер запущено: http://localhost:${PORT}`);
});
