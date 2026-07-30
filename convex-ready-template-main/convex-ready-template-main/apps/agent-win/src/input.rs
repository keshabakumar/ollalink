use enigo::{Direction, Enigo, Key, Keyboard, Mouse, Button, Settings, Coordinate};
use std::sync::{Arc, Mutex};

pub struct InputController {
    enigo: Arc<Mutex<Enigo>>,
}

impl InputController {
    pub fn new() -> Self {
        let enigo = Enigo::new(&Settings::default()).expect("Failed to initialize Enigo input controller");
        Self {
            enigo: Arc::new(Mutex::new(enigo)),
        }
    }

    pub fn mouse_move(&self, x_percent: f64, y_percent: f64, screen_width: i32, screen_height: i32) {
        let target_x = (x_percent * screen_width as f64) as i32;
        let target_y = (y_percent * screen_height as f64) as i32;

        if let Ok(mut enigo) = self.enigo.lock() {
            let _ = enigo.move_mouse(target_x, target_y, Coordinate::Abs);
        }
    }

    pub fn mouse_click(&self, button_str: &str, down: bool) {
        let button = match button_str {
            "left" => Button::Left,
            "right" => Button::Right,
            "middle" => Button::Middle,
            _ => Button::Left,
        };

        let direction = if down { Direction::Press } else { Direction::Release };

        if let Ok(mut enigo) = self.enigo.lock() {
            let _ = enigo.button(button, direction);
        }
    }

    pub fn key_press(&self, key_str: &str, down: bool) {
        let direction = if down { Direction::Press } else { Direction::Release };
        if let Ok(mut enigo) = self.enigo.lock() {
            let _ = enigo.key(Key::Unicode(key_str.chars().next().unwrap_or('a')), direction);
        }
    }
}
