package main

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"
	"time"

	"github.com/segmentio/kafka-go"
)

type Weather struct {
	City        string  `json:"city"`
	Temp        float64 `json:"temp"`
	Humidity    float64 `json:"humidity"`
	Rain1h      float64 `json:"rain1h"`
	RetrievedAt string  `json:"retrieved_at"`
}

func fetch(city, apiKey string) (*Weather, error) {
	url := fmt.Sprintf(
		"https://api.openweathermap.org/data/2.5/weather?q=%s&appid=%s&units=metric",
		city, apiKey,
	)

	resp, err := http.Get(url)
	if err != nil {
		return nil, fmt.Errorf("fetch error: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("bad response from API: %s", resp.Status)
	}

	var raw map[string]interface{}
	if err := json.NewDecoder(resp.Body).Decode(&raw); err != nil {
		return nil, fmt.Errorf("decode error: %w", err)
	}

	mainData, _ := raw["main"].(map[string]interface{})
	temp, _ := mainData["temp"].(float64)
	hum, _ := mainData["humidity"].(float64)

	var rain1h float64
	if rainMap, ok := raw["rain"].(map[string]interface{}); ok {
		if val, ok := rainMap["1h"].(float64); ok {
			rain1h = val
		}
	}

	return &Weather{
		City:        city,
		Temp:        temp,
		Humidity:    hum,
		Rain1h:      rain1h,
		RetrievedAt: time.Now().UTC().Format(time.RFC3339),
	}, nil
}

func main() {
	apiKey := os.Getenv("OWM_API_KEY")
	if apiKey == "" {
		log.Fatal("Missing OWM_API_KEY environment variable")
	}

	broker := os.Getenv("KAFKA_BROKER")

	if broker == "" {
    	broker = "127.0.0.1:9092"
	}

	writer := kafka.NewWriter(kafka.WriterConfig{
    	Brokers: []string{broker},
    	Topic:   "weather_stream",
    	Balancer: &kafka.LeastBytes{},
	})
	
	defer writer.Close()

	cities := []string{"Philadelphia,US", "New York,US", "Boston,US"}

	log.Println("Starting SafetyNet Weather Producer...")
	for {
		for _, city := range cities {
			data, err := fetch(city, apiKey)
			if err != nil {
				log.Println("Error fetching data:", err)
				continue
			}

			bytes, _ := json.Marshal(data)
			err = writer.WriteMessages(context.Background(), kafka.Message{Value: bytes})
			if err != nil {
				log.Println("Kafka write error:", err)
				continue
			}
			log.Printf("Sent: %+v\n", data)
			time.Sleep(2 * time.Second) 
		}

		time.Sleep(5 * time.Minute)
	}
}