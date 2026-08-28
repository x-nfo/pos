<?php

use App\Http\Controllers\DocumentController;
use Illuminate\Contracts\Console\Kernel;

require __DIR__.'/vendor/autoload.php';
$app = require_once __DIR__.'/bootstrap/app.php';
$kernel = $app->make(Kernel::class);
$kernel->bootstrap();

try {
    $controller = app()->make(DocumentController::class);
    $response = $controller->shipping('TRX-2563H9EP53');
    $response->getContent(); // This forces rendering
    echo "Success\n";
} catch (Exception $e) {
    echo 'Exception: '.$e->getMessage().' at '.$e->getFile().':'.$e->getLine()."\n";
} catch (Error $e) {
    echo 'Error: '.$e->getMessage().' at '.$e->getFile().':'.$e->getLine()."\n";
}
