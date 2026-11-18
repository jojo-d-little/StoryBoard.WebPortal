# Directional water effects fixture

`effects.json` is a maintained fixture subset generated from `Storyboard.GameEngine.Configuration` 1.0.25-local.20261114.t145806369, entry `Config/presentation-effects.catalog.json`. It contains `particle.water-fountain` and `particle.electrical-arcing`, including continuous/surge streams, all nine controls for both families, signed X/Y acceleration bindings and package image-slot IDs. Do not edit by hand; regenerate from the corrected configuration package when that artifact changes.

The browser harness binds a custom project image locator for fountain `rain-ripple` and uses package default art for electrical-arcing `fragment`. It places four independently tuned fountain emitters around one basin and checks their continuous and surge acceleration mappings.
