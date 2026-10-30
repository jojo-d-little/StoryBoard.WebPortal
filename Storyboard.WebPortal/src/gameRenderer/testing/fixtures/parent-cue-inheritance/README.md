# Parent cue inheritance Host fixtures

These files are copied verbatim from the Engine-owned current-contract fixtures:

`C:\work\GIT\StoryBoard.GameEngine\Storyboard.GameEngine.Tests\Fixtures\ParentCueInheritance\Host\baseline.json`

`C:\work\GIT\StoryBoard.GameEngine\Storyboard.GameEngine.Tests\Fixtures\ParentCueInheritance\Host\delta.json`

Engine test: `RuntimeRenderablePlacementNormalizationTests`. The Portal regression feeds the baseline's actual flat renderable list to the production Host mapper and applies the actual delta list through `mapHostSessionDataToSceneSnapshot`. The fixture includes shared activation IDs, separately activated child Scale, all four new cue categories, Movement opt-out, a fixed object, and point-light/emitter source anchors. No relationship or cue-origin field is added by Portal.
