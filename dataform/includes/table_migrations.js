function dropPartitionedTableOnce(selfTable) {
  const tablePath = selfTable.replaceAll("`", "");
  const [projectId, datasetId, tableName] = tablePath.split(".");
  const columnsPath = `${projectId}.${datasetId}.INFORMATION_SCHEMA.COLUMNS`;

  return `
    if exists (
      select 1
      from \`${columnsPath}\`
      where table_name = "${tableName}"
        and is_partitioning_column = "YES"
    ) then
      drop table ${selfTable};
    end if;
  `;
}

module.exports = {
  dropPartitionedTableOnce,
};
