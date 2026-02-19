package com.javadiv.mailer.controller;

import com.javadiv.mailer.dto.*;
import com.javadiv.mailer.service.CampaignService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/campaigns")
public class CampaignController {

    private final CampaignService campaignService;

    public CampaignController(CampaignService campaignService) {
        this.campaignService = campaignService;
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public CampaignResponse create(@Valid @RequestBody CreateCampaignRequest request) {
        return campaignService.create(request);
    }

    @PostMapping("/{id}/schedule")
    public CampaignResponse schedule(@PathVariable Long id, @Valid @RequestBody ScheduleCampaignRequest request) {
        return campaignService.schedule(id, request);
    }

    @PostMapping("/{id}/send-now")
    @ResponseStatus(HttpStatus.ACCEPTED)
    public void sendNow(@PathVariable Long id) {
        campaignService.sendNow(id);
    }

    @GetMapping("/{id}/status")
    public CampaignStatusResponse status(@PathVariable Long id) {
        return campaignService.status(id);
    }
}
