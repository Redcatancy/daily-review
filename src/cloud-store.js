export function createCloudStore(client, { pageSize = 500 } = {}) {
  async function fetchAll(userId) {
    try {
      const rows = []
      for (let from = 0; ; from += pageSize) {
        const { data, error } = await client
          .from('daily_entries')
          .select('date, checkin, highlights, diary')
          .eq('user_id', userId)
          .order('date', { ascending: true })
          .range(from, from + pageSize - 1)

        if (error) return { kind: 'failure', error }
        rows.push(...data)
        if (data.length < pageSize) break
      }

      const mapped = Object.fromEntries(rows.map(row => [row.date, {
        checkin: row.checkin,
        highlights: row.highlights,
        diary: row.diary
      }]))
      return rows.length === 0
        ? { kind: 'empty', data: {} }
        : { kind: 'success', data: mapped }
    } catch (error) {
      return { kind: 'failure', error }
    }
  }

  async function upsertFields(userId, date, fields) {
    try {
      const { error } = await client.from('daily_entries').upsert(
        { user_id: userId, date, ...fields },
        { onConflict: 'user_id,date' }
      )
      return error ? { kind: 'failure', error } : { kind: 'success' }
    } catch (error) {
      return { kind: 'failure', error }
    }
  }

  return { fetchAll, upsertFields }
}
