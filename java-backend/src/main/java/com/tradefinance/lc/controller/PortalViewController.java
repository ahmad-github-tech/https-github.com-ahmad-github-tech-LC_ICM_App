package com.tradefinance.lc.controller;

import com.tradefinance.lc.service.IcmCaseGatewayService;
import org.springframework.stereotype.Controller;
import org.springframework.ui.Model;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestParam;

@Controller
public class PortalViewController {

    private final IcmCaseGatewayService gatewayService;

    public PortalViewController(IcmCaseGatewayService gatewayService) {
        this.gatewayService = gatewayService;
    }

    @GetMapping("/login")
    public String loginPage() {
        return "login";
    }

    @PostMapping("/login")
    public String doLogin(@RequestParam String username) {
        return "redirect:/dashboard?user=" + username;
    }

    @GetMapping("/dashboard")
    public String dashboard(@RequestParam(defaultValue = "Ahmad Jamal") String user, Model model) {
        model.addAttribute("currentUser", user);
        model.addAttribute("inBaskets", gatewayService.getInBaskets());
        model.addAttribute("workItems", gatewayService.getWorkItems(null));
        return "dashboard";
    }
}
