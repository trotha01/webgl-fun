module Triangle exposing (main)

import Browser
import Browser.Events exposing (onAnimationFrameDelta, onClick)
import Html exposing (Html)
import Html.Attributes exposing (width, height, style)
import WebGL exposing (Mesh, Shader)
import Math.Matrix4 as Mat4 exposing (Mat4)
import Math.Vector3 as Vec3 exposing (vec3, Vec3)
import Json.Decode as D exposing (Value)

canvasWidth = 400
canvasHeight = 400

main =
    Browser.element
        { init = init
        , view = view
        , subscriptions = subscriptions
        , update = update --  (\elapsed currentTime -> ( elapsed + currentTime, Cmd.none ))
        }

type alias Model = {
  mouse: Position
  }

type alias Position =
  { x: Float
  , y: Float
  }

init : {} -> (Model, Cmd Msg)
init flags = ({
    mouse = {x = 0, y = 0}
  }, Cmd.none)

type Msg =
  MouseClick Position
  | Tick Float

decodeClick : D.Decoder Position
decodeClick =
  D.map2 Position
    (D.map transformX (D.field "clientX" D.float))
    (D.map transformY (D.field "clientY" D.float))

transformX : Float -> Float
transformX x =
  (x - (canvasWidth/2)) / (canvasWidth / 2)

transformY : Float -> Float
transformY y =
  ((canvasHeight/2) - y) / (canvasHeight / 2)

subscriptions : Model -> Sub Msg
subscriptions model =
  Sub.batch
    [ onAnimationFrameDelta Tick
    , onClick (decodeClick |> D.map MouseClick)
    ]

update : Msg -> Model ->  (Model, Cmd Msg)
update msg model =
  case msg of
    Tick delta -> (model, Cmd.none)
    MouseClick pos -> ({ model | mouse = pos }, Cmd.none)

view : Model -> Html msg
view model =
    WebGL.toHtml
        [ width canvasWidth
        , height canvasHeight
        , style "display" "block"
        ]
        [ WebGL.entity
            vertexShader
            fragmentShader
            (mesh model)
            { perspective = perspective (0 / 1000) }
        ]


perspective : Float -> Mat4
perspective delta =
    Mat4.mul
        (Mat4.makePerspective 45 1 0.01 100)
        (Mat4.makeLookAt (vec3 (4 * cos delta) 0 (4 * sin delta)) (vec3 0 0 0) (vec3 0 1 0))



-- Mesh


type alias Vertex =
    { position : Vec3
    }


mesh : Model -> Mesh Vertex
mesh model =
    WebGL.points
        [ Vertex (vec3  model.mouse.x  model.mouse.y  0)
        , Vertex (vec3 -1  0  0)
        , Vertex (vec3  1  0  0)
        , Vertex (vec3  0  -1 0)
        , Vertex (vec3  0  1  0)
        , Vertex (vec3  1  1  0)
        , Vertex (vec3 -1 -1  0)
        ]



-- Shaders


type alias Uniforms =
    { perspective : Mat4 }


vertexShader : Shader Vertex Uniforms {}
vertexShader =
    [glsl|
        attribute vec3 position;

        void main () {
            gl_Position = vec4(position, 1.0);
            gl_PointSize = 20.0;
        }
    |]


fragmentShader : Shader {} Uniforms {}
fragmentShader =
    [glsl|
        void main () {
            gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0);
        }
    |]
