-- Первоначальное заполнение справочников (СРО 10, таблица 7)

INSERT OR IGNORE INTO car_classes (id, name) VALUES
  (1, 'Эконом'), (2, 'Комфорт'), (3, 'Бизнес'), (4, 'Внедорожник'), (5, 'Минивэн');

INSERT OR IGNORE INTO car_statuses (id, name) VALUES
  (1, 'Свободен'), (2, 'Забронирован'), (3, 'В аренде'), (4, 'На техническом обслуживании'), (5, 'Недоступен');

INSERT OR IGNORE INTO booking_statuses (id, name) VALUES
  (1, 'Создано'), (2, 'Подтверждено'), (3, 'Отменено'), (4, 'Автомобиль выдан'), (5, 'Завершено');

INSERT OR IGNORE INTO contract_statuses (id, name) VALUES
  (1, 'Оформлен'), (2, 'Оплачен'), (3, 'Закрыт'), (4, 'Расторгнут');

INSERT OR IGNORE INTO tariffs (id, class_id, name, price_per_day) VALUES
  (1, 1, 'Эконом', 18000), (2, 2, 'Комфорт', 25000), (3, 3, 'Бизнес', 45000),
  (4, 4, 'Внедорожник', 40000), (5, 5, 'Минивэн', 35000);

INSERT OR IGNORE INTO payment_methods (id, name) VALUES
  (1, 'Наличные'), (2, 'Банковская карта'), (3, 'Kaspi QR');

INSERT OR IGNORE INTO payment_types (id, name) VALUES
  (1, 'Оплата аренды'), (2, 'Залог'), (3, 'Возврат залога'), (4, 'Оплата штрафа');

INSERT OR IGNORE INTO fine_types (id, name, default_amount) VALUES
  (1, 'Просрочка возврата', 10000),
  (2, 'Повреждение автомобиля', 0),
  (3, 'Возврат без топлива', 5000),
  (4, 'Нарушение правил дорожного движения', 0);

INSERT OR IGNORE INTO work_types (id, name) VALUES
  (1, 'Плановое ТО'), (2, 'Замена масла и фильтров'), (3, 'Ремонт'), (4, 'Технический осмотр'), (5, 'Шиномонтаж');

INSERT OR IGNORE INTO roles (id, name) VALUES
  (1, 'Менеджер'), (2, 'Кассир'), (3, 'Специалист по ТО'), (4, 'Руководитель');

INSERT OR IGNORE INTO client_types (id, name) VALUES
  (1, 'Физическое лицо'), (2, 'Юридическое лицо');

-- Перечень дополнительных услуг в документах не задан, значения учебные
INSERT OR IGNORE INTO extra_services (id, name, price_per_day) VALUES
  (1, 'Детское кресло', 1500), (2, 'GPS-навигатор', 1000), (3, 'Дополнительный водитель', 2000);
