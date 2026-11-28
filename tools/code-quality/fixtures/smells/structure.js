export function Nested(rows)
{
    for (const row of rows)
    {
        if (row.ready)
        {
            while (row.pending)
            {
                if (row.blocked)
                {
                    return row;
                }
                else if (row.done)
                {
                    break;
                }
            }
        }
    }
    return null;
}
