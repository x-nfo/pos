<?php

return [
    /*
    |--------------------------------------------------------------------------
    | Audit Log Retention Days
    |--------------------------------------------------------------------------
    |
    | Number of days to retain audit log records before they are automatically
    | pruned by the model:prune scheduler command.
    |
    */
    'retention_days' => env('AUDIT_LOG_RETENTION_DAYS', 90),
];
