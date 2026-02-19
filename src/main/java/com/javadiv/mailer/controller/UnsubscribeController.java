package com.javadiv.mailer.controller;

import com.javadiv.mailer.dto.UnsubscribeResponse;
import com.javadiv.mailer.service.UnsubscribeService;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/unsubscribe")
public class UnsubscribeController {

    private final UnsubscribeService unsubscribeService;

    public UnsubscribeController(UnsubscribeService unsubscribeService) {
        this.unsubscribeService = unsubscribeService;
    }

    @GetMapping("/{token}")
    public UnsubscribeResponse unsubscribe(@PathVariable String token) {
        return unsubscribeService.unsubscribe(token);
    }
}
